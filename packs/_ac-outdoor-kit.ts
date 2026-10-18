/**
 * Shared builders for split air-conditioner outdoor units (condensers), window air conditioners and
 * their mounts, used by the branded-climate-vn, branded-ac-outdoor-vn and ac-outdoor-units packs.
 * Not a pack itself: the loader only reads `*.pack.ts`, and files starting with "_" are skipped.
 *
 * Packs that use these builders add `AC_PATTERNS` and `AC_MATERIALS` to their own patterns and
 * materials (pack ids are local, so each pack carries its own copy).
 */
import {
  clamp,
  cyl,
  discZ,
  matSlot,
  range,
  rod,
  span,
  sphere,
  torus,
  vcyl,
  type MaterialSlot,
  type PackMaterial,
  type PackPattern,
  type Part,
  type Size3,
  type V2,
  type V3,
} from '@/packs/kit';

const o = { plan: false };

/** Wire or plastic guard in front of a condenser fan. */
export type GuardStyle =
  /** Domed concentric wire rings on eight spokes (Panasonic, Casper). */
  | 'rings'
  /** One spiral wire on four support wires (LG, Gree, Toshiba). */
  | 'spiral'
  /** Many radial wires between three rings (Daikin VRV, older units). */
  | 'radial'
  /** Horizontal bars across the round opening (Samsung, Funiki). */
  | 'hbars'
  /** Crossed diagonal bars (Mitsubishi Electric). */
  | 'diamond'
  /** Square wire mesh (commercial units). */
  | 'grid'
  /** Square plastic grille of slanted horizontal louvres (Daikin small units, Nagakawa). */
  | 'louvre';

export interface CondenserSpec {
  /**
   * 'split': front-discharge wall unit, coil on the left and back, valve cover and service valves on
   * the right side, on two base rails. 'cabinet': side-discharge multi-split / mini-VRF box with a
   * service column on the front right (panel, rating plate, valves out the front) on a base frame.
   */
  layout?: 'split' | 'cabinet';
  /** One fan, or two stacked fans. */
  fans?: 1 | 2;
  /** Fan centre x as a share of the casing width, from the left. */
  fanX?: number;
  /** Fan opening radius as a share of the unit height (clamped to fit its cell). */
  fanR?: number;
  blades?: 3 | 4 | 5;
  guard?: GuardStyle;
  /** Rise of a domed guard at its centre (m); flat guards use 0. */
  dome?: number;
  /** Plastic louvre grille moulded in the casing colour (otherwise the 'grille' slot). */
  guardInBody?: boolean;
  /** Stamped ribs across the top panel. */
  ribs?: number;
  /** Width of the cabinet service column as a share of the width. */
  column?: number;
}

/** Slots every condenser uses (built by `condenser`). */
export function condenserSlots(casing = 'climate-casing', coil = 'climate-coil'): MaterialSlot[] {
  return [
    matSlot('body', 'Casing & pipe insulation', casing),
    matSlot('grille', 'Fan, guard, labels & feet pads', 'climate-fan-charcoal'),
    matSlot('fins', 'Condenser coil', coil),
    matSlot('pipes', 'Copper valves', 'metal-copper'),
  ];
}

/** Euler XYZ angles for a rotation of `theta` about z after a tilt of `q` about x (Rz(theta)·Rx(q)). */
function zxEuler(theta: number, q: number): V3 {
  const c = Math.cos(theta);
  const sn = Math.sin(theta);
  return [Math.atan2(c * Math.sin(q), Math.cos(q)), Math.asin(sn * Math.sin(q)), Math.atan2(sn * Math.cos(q), c)];
}

/**
 * One panel of a fan blade: a thin flat outline between radii r0 and r1 (shares of `fr`) in the fan
 * plane, swept with the radius, turned to angle `a` and pitched by `pitch` about its radial axis.
 */
function bladePanel(fx: number, fy: number, z: number, fr: number, a: number, pitch: number, r0: number, r1: number, w0: number, w1: number, sweep: number, tip: boolean): Part {
  const edge = (side: 1 | -1) =>
    range(6).map((i): V2 => {
      const k = i / 5;
      const r = fr * (r0 + (r1 - r0) * k);
      const ang = sweep * (r / fr) ** 2;
      const hw = (fr * (w0 + (w1 - w0) * k)) / 2;
      return [r * Math.cos(ang) - side * hw * Math.sin(ang), r * Math.sin(ang) + side * hw * Math.cos(ang)];
    });
  const lead = edge(1);
  const trail = edge(-1).reverse();
  const pts: V2[] = [...lead];
  if (tip) {
    // Rounded tip between the two edges.
    const [lx, ly] = lead[lead.length - 1];
    const [tx, ty] = trail[0];
    const ang = sweep * r1 ** 2;
    pts.push([(lx + tx) / 2 + Math.cos(ang) * fr * 0.05, (ly + ty) / 2 + Math.sin(ang) * fr * 0.05]);
  }
  pts.push(...trail);
  // Blade frame: u radial (local x), v across (local -z), thickness along local y; re-centred.
  const us = pts.map((p) => p[0]);
  const vs = pts.map((p) => p[1]);
  const cu = (Math.min(...us) + Math.max(...us)) / 2;
  const cv = (Math.min(...vs) + Math.max(...vs)) / 2;
  const outline = pts.map(([u, v]) => [u - cu, -(v - cv)] as V2);
  const q = pitch + Math.PI / 2;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  // Rz(a)·Rx(q) applied to the outline centre (cu, 0, -cv) gives the panel's offset from the hub.
  const lz = -cv;
  const off: V3 = [c * cu + sn * Math.sin(q) * lz, sn * cu - c * Math.sin(q) * lz, Math.cos(q) * lz];
  return { shape: 'prism', outline, height: 0.003, position: [fx + off[0], fy + off[1], z + off[2]], rotation: zxEuler(a, q), slot: 'grille', plan: false };
}

/**
 * Fan in the front panel opening: a shallow bell-mouth orifice (rolled lip on the panel face, a
 * throat a few centimetres deep), swept blades whose pitch twists from root to tip, the hub with a
 * spinner, and the motor behind it on the bracket at `zMotor`.
 */
function fanUnit(parts: Part[], fx: number, fy: number, zf: number, fr: number, blades: number, zMotor: number) {
  // Bell-mouth: closed lathe loop (outer surface up, lip, inner surface down), axis along z.
  const prof: V2[] = [
    [fr + 0.004, -0.045],
    [fr + 0.004, -0.012],
    [fr + 0.007, -0.004],
    [fr + 0.013, -0.0005],
    [fr + 0.02, 0.0012],
    [fr + 0.017, 0.0055],
    [fr + 0.009, 0.0082],
    [fr + 0.003, 0.0062],
    [fr + 0.0004, 0.0025],
    [fr, -0.008],
    [fr, -0.0451],
  ];
  const ys = prof.map((p) => p[1]);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  parts.push({ shape: 'lathe', profile: prof.map(([r, y]) => [r, y - mid] as V2), position: [fx, fy, zf + mid], rotation: [Math.PI / 2, 0, 0], segments: 48, slot: 'grille', plan: false });
  // Hub, spinner and the motor behind them.
  const zc = zf - 0.022;
  parts.push(
    discZ('grille', [fx, fy, zc], fr * 0.15, 0.034, { segments: 24, plan: false }),
    cyl('grille', [fx, fy, zc + 0.021], fr * 0.12, 0.008, { rTop: fr * 0.05, rotation: [Math.PI / 2, 0, 0], segments: 20, plan: false }),
  );
  if (zMotor < zc - 0.03) parts.push(discZ('grille', [fx, fy, (zc - 0.017 + zMotor) / 2], fr * 0.2, zc - 0.017 - zMotor, { segments: 24, plan: false }));
  // Blades: a root panel with more pitch and a swept tip panel with less (the twist).
  const r0 = 0.13;
  const rTip = 0.91;
  const wRoot = blades === 3 ? 0.2 : blades === 4 ? 0.16 : 0.13;
  const wTip = blades === 3 ? 0.62 : blades === 4 ? 0.5 : 0.4;
  const rm = 0.5;
  const wm = wRoot + (wTip - wRoot) * ((rm - r0) / (rTip - r0)) * 1.15;
  // Pitch keeps each panel within ±16 mm of the hub plane, inside the throat; the root always twists more.
  const pTip = Math.min(0.32, Math.asin(Math.min(1, 0.016 / ((fr * wTip) / 2))));
  const pRoot = Math.max(pTip + 0.12, Math.min(0.5, Math.asin(Math.min(1, 0.016 / ((fr * wm) / 2)))));
  for (const k of range(blades)) {
    const ang = (k / blades) * Math.PI * 2 + 0.3;
    parts.push(bladePanel(fx, fy, zc, fr, ang, pRoot, r0, rm + 0.01, wRoot, wm, 0.55, false), bladePanel(fx, fy, zc, fr, ang, pTip, rm, rTip, wm, wTip, 0.55, true));
  }
}

/** Points along chords of a circle of radius `r` at angle `theta`, every `sp` metres. */
function chords(r: number, theta: number, sp: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const n = Math.max(1, Math.floor((2 * r) / sp));
  for (const k of range(n)) {
    const off = -r + ((2 * r) / n) * (k + 0.5);
    const half = Math.sqrt(Math.max(0, r * r - off * off));
    if (half < 0.012) continue;
    const cx = -uy * off;
    const cy = ux * off;
    out.push([cx - ux * half, cy - uy * half, cx + ux * half, cy + uy * half]);
  }
  return out;
}

/** The guard over one fan opening, `zg` = its back plane. */
function fanGuard(parts: Part[], spec: CondenserSpec, fx: number, fy: number, zf: number, zg: number, fr: number, twin: boolean) {
  const style = spec.guard ?? 'rings';
  const dome = spec.dome ?? (style === 'rings' ? 0.012 : style === 'spiral' ? 0.008 : 0);
  const zAt = (r: number) => zg + dome * (1 - r / fr);
  const wire = 0.0016;
  const badge = () => {
    parts.push(
      discZ('grille', [fx, fy, zg + dome + 0.0005], fr * 0.17, 0.003, { segments: 28, plan: false }),
    );
  };
  if (style === 'rings') {
    const nr = clamp(Math.round(fr / 0.026), 6, twin ? 9 : 11);
    for (const i of range(nr)) {
      const r = fr * (0.16 + (0.84 * (i + 1)) / nr) - 0.004;
      parts.push(torus('grille', [fx, fy, zAt(r)], r, wire, o));
    }
    for (const k of range(8)) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const r0 = fr * 0.17;
      const r1 = fr - 0.004;
      parts.push(rod('grille', [fx + Math.cos(a) * r0, fy + Math.sin(a) * r0, zAt(r0)], [fx + Math.cos(a) * r1, fy + Math.sin(a) * r1, zAt(r1)], 0.0018, { segments: 6, plan: false }));
    }
    badge();
  } else if (style === 'spiral') {
    // Two-centre spiral: upper half-circles about the centre, lower ones about a point half a pitch right.
    const r0 = fr * 0.17;
    const turns = clamp(Math.round((fr * 0.83) / 0.021), 6, twin ? 9 : 11);
    const s = (fr - 0.006 - r0) / turns;
    for (const k of range(turns)) {
      const r = r0 + k * s;
      parts.push(torus('grille', [fx, fy, zAt(r)], r, wire, { arc: Math.PI, plan: false }));
      parts.push(torus('grille', [fx + s / 2, fy, zAt(r + s / 2)], r + s / 2, wire, { arc: Math.PI, rotation: [0, 0, Math.PI], plan: false }));
    }
    parts.push(torus('grille', [fx, fy, zg], fr - 0.003, 0.0022, o));
    for (const k of range(4)) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      parts.push(rod('grille', [fx + Math.cos(a) * r0, fy + Math.sin(a) * r0, zAt(r0) - 0.003], [fx + Math.cos(a) * (fr - 0.004), fy + Math.sin(a) * (fr - 0.004), zg - 0.003], 0.0018, { segments: 6, plan: false }));
    }
    badge();
  } else if (style === 'radial') {
    const n = twin ? 24 : 32;
    const r0 = fr * 0.17;
    for (const r of [r0 + 0.002, fr * 0.58, fr - 0.003]) parts.push(torus('grille', [fx, fy, zAt(r) + 0.002], r, 0.002, o));
    for (const k of range(n)) {
      const a = (k / n) * Math.PI * 2;
      parts.push(rod('grille', [fx + Math.cos(a) * r0, fy + Math.sin(a) * r0, zAt(r0)], [fx + Math.cos(a) * (fr - 0.003), fy + Math.sin(a) * (fr - 0.003), zAt(fr)], wire, { segments: 5, plan: false }));
    }
    badge();
  } else if (style === 'hbars' || style === 'diamond' || style === 'grid') {
    const dirs = style === 'hbars' ? [0] : style === 'diamond' ? [Math.PI / 4, -Math.PI / 4] : [0, Math.PI / 2];
    const per = style === 'hbars' ? (twin ? 22 : 26) : twin ? 11 : 13;
    const rr = fr - 0.004;
    dirs.forEach((th, i) => {
      for (const [x0, y0, x1, y1] of chords(rr, th, Math.max(style === 'hbars' ? 0.013 : 0.022, (2 * rr) / per))) {
        const z = zg + 0.004 - i * 0.0035;
        parts.push(rod('grille', [fx + x0, fy + y0, z], [fx + x1, fy + y1, z], wire, { segments: 5, plan: false }));
      }
    });
    parts.push(torus('grille', [fx, fy, zg + 0.002], fr - 0.003, 0.0024, o));
    if (style === 'hbars') {
      // Two vertical support wires behind the bars.
      for (const s of [-0.4, 0.4]) {
        const half = Math.sqrt(rr * rr - (s * rr) ** 2);
        parts.push(rod('grille', [fx + s * rr, fy - half, zg], [fx + s * rr, fy + half, zg], 0.0018, { segments: 5, plan: false }));
      }
    }
  } else {
    // Louvre grille: a square frame round the opening with slanted horizontal slats.
    const slot = spec.guardInBody ? 'body' : 'grille';
    const a = fr + 0.014;
    const fd = 0.028;
    const ft = 0.014;
    parts.push(
      span(slot, [fx - a, fx + a], [fy + a - ft, fy + a], [zf, zf + fd], { bevel: 0.002, plan: false }),
      span(slot, [fx - a, fx + a], [fy - a, fy - a + ft], [zf, zf + fd], { bevel: 0.002, plan: false }),
      span(slot, [fx - a, fx - a + ft], [fy - a + ft, fy + a - ft], [zf, zf + fd], { bevel: 0.002, plan: false }),
      span(slot, [fx + a - ft, fx + a], [fy - a + ft, fy + a - ft], [zf, zf + fd], { bevel: 0.002, plan: false }),
      span(slot, [fx - 0.004, fx + 0.004], [fy - a + ft, fy + a - ft], [zf + 0.012, zf + fd - 0.002], o),
    );
    const n = clamp(Math.round((2 * (a - ft)) / 0.021), 8, twin ? 22 : 28);
    for (const k of range(n)) {
      const y = fy - a + ft + ((2 * (a - ft)) / n) * (k + 0.5);
      parts.push({ shape: 'box', size: [2 * (a - ft), 0.0035, 0.011], position: [fx, y, zf + 0.021], rotation: [-0.6, 0, 0], slot, plan: false });
    }
  }
}

/**
 * Split-AC outdoor unit (condenser), front +z, built inside its box:
 *  - painted steel casing: top panel with stamped ribs and a small front overhang, front panel,
 *    right side panel with a carrying recess and the rating label, base pan;
 *  - aluminium coil (fin texture) on the left side and the back behind wire guards, a dark inside
 *    seen through the fan opening;
 *  - per fan: bellmouth ring, dark shroud, swept blades on a motor hub with a spinner, and the guard
 *    (see `GuardStyle`);
 *  - split layout: valve cover with screws on the right, two copper service valves with flare nuts
 *    and caps, the insulated pipe run bending back to the wall, two base rails with anchor slots on
 *    rubber pads, and the drain socket under the base pan;
 *  - cabinet layout: service column on the front right (screwed panel with a handle recess, rating
 *    plate, valves out of the front), base frame with forklift openings.
 */
export function condenser({ w, d, h }: Size3, spec: CondenserSpec = {}): Part[] {
  const cab = spec.layout === 'cabinet';
  const nf = spec.fans ?? 1;
  const guard = spec.guard ?? 'rings';
  const dome = spec.dome ?? (guard === 'rings' ? 0.012 : guard === 'spiral' ? 0.008 : 0);
  const proud = guard === 'louvre' ? 0.03 : 0.018 + dome;
  const zf = d / 2 - proud;
  const zb = -d / 2;
  const y0 = cab ? 0.07 : 0.032; // casing bottom (rails or base frame below)
  const t = 0.01;
  const cov = cab ? 0.006 : clamp(w * 0.042, 0.022, 0.036); // valve cover beyond the right side panel
  const xl = -w / 2;
  const xr = w / 2 - cov;
  const yt = h - 0.016; // underside of the top panel
  const yb = y0 + 0.014; // top of the base pan
  const parts: Part[] = [];
  // Casing: top panel, front, right side and base pan; coil on the left and back.
  parts.push(
    span('body', [xl, xr], [yt, h - 0.002], [zb, zf + 0.006], { bevel: 0.006 }),
    span('body', [xr - t, xr], [y0, yt], [zb + 0.004, zf - t], o),
    span('body', [xl, xr], [y0, yb], [zb, zf], o),
    span('body', [xl, xl + 0.016], [y0, yt], [zf - 0.03, zf], o),
    span('fins', [xl + 0.002, xl + 0.014], [yb, yt], [zb + 0.004, zf - 0.03], o),
    span('fins', [xl + 0.014, xr - t], [yb, yt], [zb + 0.002, zb + 0.022], o),
  );
  // Stamped ribs on the top panel and a carrying recess on the right side.
  const nRibs = spec.ribs ?? (d > 0.3 ? 3 : 2);
  for (const k of range(nRibs)) {
    const z = zb + ((zf - zb) * (k + 1)) / (nRibs + 1);
    parts.push(span('body', [xl + 0.05, xr - 0.05], [h - 0.002, h], [z - 0.012, z + 0.012], { bevel: 0.001, plan: false }));
  }
  parts.push(span('grille', [xr - 0.0005, xr + 0.001], [yt - 0.06, yt - 0.04], [zb + d * 0.36, zb + d * 0.64], { bevel: 0.002, plan: false }));
  // Wire guards over the exposed coil: back and left side.
  const nv = clamp(Math.round(w / 0.13), 4, 9);
  const nh = clamp(Math.round(h / 0.17), 3, 8);
  for (const k of range(nv)) parts.push(vcyl('grille', xl + 0.03 + ((xr - xl - 0.06) * (k + 0.5)) / nv, zb + 0.0015, yb + 0.006, yt - 0.006, 0.001, o));
  for (const k of range(nh)) {
    const y = yb + ((yt - yb) * (k + 0.5)) / nh;
    parts.push(rod('grille', [xl + 0.02, y, zb + 0.0015], [xr - 0.02, y, zb + 0.0015], 0.001, o));
  }
  for (const k of range(clamp(Math.round(h / 0.25), 2, 6))) {
    const y = yb + ((yt - yb) * (k + 0.5)) / clamp(Math.round(h / 0.25), 2, 6);
    parts.push(rod('grille', [xl + 0.0015, y, zb + 0.02], [xl + 0.0015, y, zf - 0.04], 0.001, o));
  }

  // Fans: openings, rotors and guards.
  const colW = cab ? w * (spec.column ?? 0.2) : 0;
  const fx = xl + w * (spec.fanX ?? (cab ? (1 - (spec.column ?? 0.2)) / 2 : 0.38));
  const cellH = (yt - yb) / nf;
  const fr = Math.min(h * (spec.fanR ?? 0.4), cellH / 2 - (guard === 'louvre' ? 0.03 : 0.014), fx - xl - (guard === 'louvre' ? 0.04 : 0.024), (cab ? xr - colW : xr) - fx - 0.03);
  const fanYs = range(nf).map((k) => yb + cellH * (k + 0.5));
  // Front panel built round the fan holes: side strips, strips between the holes and corner pieces
  // (square corner minus the quarter circle), so the fan chamber shows through.
  const rh = fr + 0.004;
  parts.push(span('body', [xl + 0.004, fx - rh], [y0, yt], [zf - t, zf], o), span('body', [fx + rh, xr], [y0, yt], [zf - t, zf], o));
  const gaps: V2[] = [];
  let gy = y0;
  for (const fy of fanYs) {
    gaps.push([gy, fy - rh]);
    gy = fy + rh;
  }
  gaps.push([gy, yt]);
  for (const [g0, g1] of gaps) if (g1 - g0 > 0.001) parts.push(span('body', [fx - rh, fx + rh], [g0, g1], [zf - t, zf], o));
  for (const fy of fanYs) {
    for (const [sx, sy] of [
      [1, 1],
      [-1, 1],
      [-1, -1],
      [1, -1],
    ] as const) {
      // Outline in world x/y, written as prism [x, -y] (the x quarter turn extrudes it along +z).
      const pts: V2[] = [[sx * rh, sy * rh], ...range(9).map((i): V2 => [sx * rh * Math.cos((i / 8) * (Math.PI / 2)), sy * rh * Math.sin((i / 8) * (Math.PI / 2))])];
      const cx = (sx * rh) / 2;
      const cy = (sy * rh) / 2;
      parts.push({ shape: 'prism', outline: pts.map(([x, y]) => [x - cx, -(y - cy)] as V2), height: t, position: [fx + cx, fy + cy, zf - t], rotation: [Math.PI / 2, 0, 0], slot: 'body', plan: false });
    }
  }
  // Fan chamber: a dark partition plate on the compressor side and the motor bracket.
  const zMotor = Math.max(zb + 0.04, zf - 0.11);
  const partX = fx + rh + 0.015;
  if (partX < xr - t - 0.02) parts.push(span('grille', [partX, partX + 0.002], [yb, yt], [zb + 0.022, zf - t], o));
  // Dark floor and ceiling in the fan chamber (the white base pan and lid would show through the hole).
  const chamberX = partX < xr - t - 0.02 ? partX : xr - t;
  parts.push(span('grille', [xl + 0.016, chamberX], [yb, yb + 0.002], [zb + 0.022, zf - t], o), span('grille', [xl + 0.016, chamberX], [yt - 0.002, yt], [zb + 0.022, zf - t], o));
  for (const s of [-1, 1]) parts.push(span('grille', [fx + s * 0.03 - 0.008, fx + s * 0.03 + 0.008], [yb, yt], [zMotor - 0.006, zMotor], o));
  for (const fy of fanYs) {
    fanUnit(parts, fx, fy, zf, fr, spec.blades ?? 4, zMotor);
    fanGuard(parts, spec, fx, fy, zf, zf + 0.01, fr, nf > 1);
  }
  const guardHalf = guard === 'louvre' ? fr + 0.014 : fr;

  // Rating plate with printed lines (no logos); on the right side panel, above the valve cover.
  const plate = (x: number, y: V3) => {
    const [py0, py1, pz] = y;
    const pz0 = pz - 0.035;
    const pz1 = pz + 0.035;
    parts.push(span('grille', [x, x + 0.0012], [py0, py1], [pz0, pz1], o));
    for (const k of range(3)) {
      const ly = py1 - (py1 - py0) * (0.25 + k * 0.22);
      parts.push(span('body', [x + 0.0012, x + 0.002], [ly - 0.002, ly + 0.002], [pz0 + 0.008, pz1 - 0.008 - k * 0.012], o));
    }
  };

  if (!cab) {
    // Small energy label and a trim line on the front right.
    const px0 = fx + guardHalf + 0.03;
    if (px0 + 0.07 < xr - 0.015) {
      parts.push(span('grille', [px0, px0 + 0.07], [y0 + (h - y0) * 0.14, y0 + (h - y0) * 0.22], [zf, zf + 0.002], o));
      parts.push(span('body', [px0 + 0.008, px0 + 0.03], [y0 + (h - y0) * 0.17, y0 + (h - y0) * 0.19], [zf + 0.002, zf + 0.0028], o));
    }
    if (px0 + 0.03 < xr - 0.015) parts.push(span('grille', [px0, xr - 0.015], [h - 0.05, h - 0.047], [zf, zf + 0.0012], o));
    const vy0 = y0 + 0.02;
    const vy1 = Math.min(y0 + (h - y0) * 0.55, vy0 + 0.32);
    plate(xr, [vy1 + 0.02, Math.min(vy1 + 0.1, yt - 0.075), zb + d * 0.55]);
    // Valve cover with two screws, the service valves under it and the insulated pipe run.
    parts.push(span('body', [xr, w / 2 - 0.002], [vy0, vy1], [zb + d * 0.15, zf - 0.02], { bevel: 0.008, plan: false }));
    for (const sy of [vy0 + 0.025, vy1 - 0.025]) parts.push(cyl('grille', [w / 2 - 0.0012, sy, zf - 0.045], 0.005, 0.002, { rotation: [0, 0, Math.PI / 2], segments: 10, plan: false }));
    const vz = zb + d * 0.1;
    for (const [k, r] of [
      [0, 0.008],
      [1, 0.011],
    ] as const) {
      const vy = vy0 + 0.035 + k * 0.05;
      parts.push(
        rod('pipes', [xr - 0.013, vy, vz], [w / 2 - 0.004, vy, vz], r + 0.004, { segments: 10, plan: false }),
        // Flare nut (hex), valve cap on top and the copper line going down.
        rod('pipes', [w / 2 - 0.02, vy, vz], [w / 2 - 0.003, vy, vz], r + 0.008, { segments: 6, plan: false }),
        rod('pipes', [w / 2 - 0.026, vy + r + 0.002, vz], [w / 2 - 0.026, vy + r + 0.016, vz], 0.007, { segments: 6, plan: false }),
        rod('pipes', [w / 2 - 0.012, vy, vz], [w / 2 - 0.012, vy - 0.02, vz], r, { segments: 10, plan: false }),
      );
    }
    // Service port (Schrader) on the gas valve.
    parts.push(rod('pipes', [w / 2 - 0.03, vy0 + 0.085, vz], [w / 2 - 0.03, vy0 + 0.085, vz + 0.022], 0.004, { segments: 8, plan: false }));
    // Pipes (wrapped in white insulation tape) bend down and run back to the wall.
    const by = vy0 + 0.01;
    parts.push(
      rod('body', [w / 2 - 0.016, vy0 + 0.06, vz], [w / 2 - 0.016, by, vz], 0.016, { segments: 12, plan: false }),
      rod('body', [w / 2 - 0.016, by, vz], [w / 2 - 0.016, by, zb + 0.004], 0.016, { segments: 12, plan: false }),
      sphere('body', [w / 2 - 0.016, by, vz], 0.016, o),
    );
    // Base rails with anchor slots on rubber pads; drain socket under the base pan.
    const inset = Math.max(0.07, w * 0.14);
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - inset) + (xr - w / 2) / 2;
      parts.push(span('body', [x - 0.025, x + 0.025], [0.012, y0], [zb + 0.002, d / 2 - 0.004], { bevel: 0.002 }));
      for (const z of [zb + 0.03, zf - 0.03]) parts.push(cyl('grille', [x, 0.006, z], 0.016, 0.012, { segments: 12, plan: false }));
      parts.push(span('grille', [x - 0.006, x + 0.006], [y0, y0 + 0.0008], [zf + 0.002, d / 2 - 0.01], o));
    }
    const dx = xl + w * 0.3;
    parts.push(vcyl('grille', dx, 0, 0.014, y0, 0.009, { segments: 12, plan: false }), torus('grille', [dx, 0.016, 0], 0.009, 0.002, { rotation: [Math.PI / 2, 0, 0], plan: false }));
  } else {
    // Service column: screwed panel with a handle recess, rating plate above it.
    const cx0 = xr - colW + 0.012;
    const cx1 = xr - 0.012;
    const py0 = yb + (yt - yb) * 0.2;
    const py1 = yb + (yt - yb) * 0.72;
    parts.push(span('body', [cx0, cx1], [py0, py1], [zf, zf + 0.003], { bevel: 0.002, plan: false }));
    for (const sx of [cx0 + 0.012, cx1 - 0.012]) for (const sy of [py0 + 0.012, py1 - 0.012]) parts.push(discZ('grille', [sx, sy, zf + 0.004], 0.005, 0.002, { segments: 10, plan: false }));
    const hcx = (cx0 + cx1) / 2;
    parts.push(span('grille', [hcx - Math.min(0.045, colW * 0.3), hcx + Math.min(0.045, colW * 0.3)], [py0 + 0.04, py0 + 0.058], [zf + 0.003, zf + 0.0045], o));
    parts.push(span('grille', [cx0 + 0.015, cx1 - 0.015], [py1 + 0.03, py1 + 0.11], [zf, zf + 0.0012], o));
    for (const k of range(3)) parts.push(span('body', [cx0 + 0.022, cx1 - 0.03 - k * 0.012], [py1 + 0.09 - k * 0.02, py1 + 0.094 - k * 0.02], [zf + 0.0012, zf + 0.002], o));
    // Service valves out of the front under the panel: liquid, gas and a caps row.
    for (const [k, r] of [
      [0, 0.008],
      [1, 0.012],
    ] as const) {
      const vx = cx0 + (cx1 - cx0) * (0.3 + k * 0.4);
      const vy = yb + 0.05;
      parts.push(
        rod('pipes', [vx, vy, zf - 0.013], [vx, vy, zf + 0.008], r + 0.004, { segments: 10, plan: false }),
        rod('pipes', [vx, vy, zf + 0.004], [vx, vy, zf + 0.018], r + 0.007, { segments: 6, plan: false }),
        rod('pipes', [vx, vy + r + 0.002, zf + 0.002], [vx, vy + r + 0.018, zf + 0.002], 0.006, { segments: 6, plan: false }),
        rod('body', [vx, vy, zf + 0.018], [vx, 0.03, zf + 0.018], r + 0.006, { segments: 12, plan: false }),
      );
    }
    plate(xr, [yb + (yt - yb) * 0.5, yb + (yt - yb) * 0.5 + 0.08, zb + d * 0.5]);
    // Base frame: two runners with anchor holes, front skirt with forklift openings.
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.04) - cov / 2;
      parts.push(span('body', [x - 0.03, x + 0.03], [0, y0], [zb, d / 2 - 0.002], { bevel: 0.003 }));
      parts.push(cyl('grille', [x, y0 + 0.0004, (zf + d / 2) / 2], 0.008, 0.0008, { segments: 12, plan: false }));
    }
    parts.push(span('body', [xl + 0.07, xr - 0.07], [0.008, y0], [zf - 0.012, zf - 0.004], o));
    for (const s of [-1, 1]) parts.push(span('grille', [s * w * 0.22 - Math.min(0.08, w * 0.1) - cov / 2, s * w * 0.22 + Math.min(0.08, w * 0.1) - cov / 2], [0.016, y0 - 0.014], [zf - 0.004, zf - 0.003], o));
  }
  return parts;
}

/**
 * Window (through-the-wall) air conditioner, room side +z: a plastic front with an intake grille of
 * slanted slats, the discharge outlet with vanes at the top, a control strip with two knobs and a
 * display; the steel chassis behind it with louvred side and top vents on the outdoor half, the
 * condenser coil and wire guard at the back, base rails and a drain plug.
 * Slots: body (chassis), front (room-side panel), grille (vents, knobs, dark parts), fins (coil).
 */
export function windowUnit({ w, d, h }: Size3): Part[] {
  const zf = d / 2;
  const zb = -d / 2;
  const fz0 = zf - 0.045; // back of the front panel
  const fp = zf - 0.012; // its face (vents, knobs and vanes stand on it)
  const parts: Part[] = [
    // Chassis sleeve (room half and outdoor half) and base pan.
    span('body', [-w / 2, w / 2], [0.015, h], [zb + 0.02, fz0], { bevel: 0.004 }),
    span('fins', [-w / 2 + 0.008, w / 2 - 0.008], [0.025, h - 0.01], [zb + 0.003, zb + 0.02], o),
    // Room-side front panel.
    span('front', [-w / 2, w / 2], [0.01, h], [fz0, fp], { bevel: 0.006 }),
  ];
  // Discharge outlet at the top with horizontal vanes; intake slats below, control strip right.
  const ctrl = Math.min(0.12, w * 0.24);
  const ox0 = -w / 2 + 0.03;
  const ox1 = w / 2 - ctrl - 0.02;
  const oy0 = h - 0.025 - Math.min(0.09, h * 0.24);
  const oy1 = h - 0.025;
  parts.push(span('grille', [ox0, ox1], [oy0, oy1], [fp, fp + 0.0015], o));
  const nvane = clamp(Math.round((oy1 - oy0) / 0.022), 3, 6);
  for (const k of range(nvane)) {
    const y = oy0 + ((oy1 - oy0) * (k + 0.5)) / nvane;
    parts.push({ shape: 'box', size: [ox1 - ox0 - 0.006, 0.004, 0.012], position: [(ox0 + ox1) / 2, y, fp + 0.006], rotation: [0.5, 0, 0], slot: 'front', plan: false });
  }
  for (const k of range(5)) {
    const x = ox0 + ((ox1 - ox0) * (k + 0.5)) / 5;
    parts.push(span('front', [x - 0.002, x + 0.002], [oy0 + 0.002, oy1 - 0.002], [fp + 0.0015, fp + 0.01], o));
  }
  const iy0 = 0.04;
  const iy1 = oy0 - 0.03;
  parts.push(span('grille', [ox0, ox1], [iy0, iy1], [fp, fp + 0.0015], o));
  const nslat = clamp(Math.round((iy1 - iy0) / 0.016), 6, 18);
  for (const k of range(nslat)) {
    const y = iy0 + ((iy1 - iy0) * (k + 0.5)) / nslat;
    parts.push({ shape: 'box', size: [ox1 - ox0, 0.004, 0.01], position: [(ox0 + ox1) / 2, y, fp + 0.006], rotation: [-0.6, 0, 0], slot: 'front', plan: false });
  }
  // Filter pull tab and the control strip: display, two knobs, two buttons.
  parts.push(span('front', [-0.02, 0.02], [iy0 - 0.02, iy0 - 0.008], [fp, fp + 0.008], { bevel: 0.002, plan: false }));
  const cx = w / 2 - ctrl / 2 - 0.012;
  parts.push(span('grille', [cx - ctrl * 0.35, cx + ctrl * 0.35], [h * 0.72, h * 0.8], [fp, fp + 0.002], o));
  for (const ky of [h * 0.55, h * 0.36]) {
    parts.push(discZ('grille', [cx, ky, fp + 0.006], Math.min(0.022, ctrl * 0.22), 0.012, { segments: 24, plan: false }));
    parts.push(span('front', [cx - 0.002, cx + 0.002], [ky, ky + Math.min(0.018, ctrl * 0.18)], [fp + 0.012, fp + 0.0128], o));
  }
  for (const s of [-1, 1]) parts.push(discZ('front', [cx + s * ctrl * 0.18, h * 0.2, fp + 0.003], 0.006, 0.006, { segments: 12, plan: false }));
  // Louvred side vents on the outdoor half: dark slots under slanted hoods.
  const vz0 = zb + 0.05;
  const vz1 = zb + (fz0 - zb) * 0.55;
  const nlv = clamp(Math.round((h - 0.08) / 0.03), 5, 9);
  for (const s of [-1, 1]) {
    for (const k of range(nlv)) {
      const y = 0.05 + ((h - 0.1) * (k + 0.5)) / nlv;
      parts.push(span('grille', s < 0 ? [-w / 2 - 0.001, -w / 2 + 0.001] : [w / 2 - 0.001, w / 2 + 0.001], [y - 0.006, y + 0.006], [vz0, vz1], o));
      parts.push({ shape: 'box', size: [0.004, 0.003, vz1 - vz0], position: [s * (w / 2 + 0.002), y + 0.008, (vz0 + vz1) / 2], rotation: [0, 0, s * 0.7], slot: 'body', plan: false });
    }
  }
  // Top vents: two rows of short slots.
  for (const k of range(6)) {
    const x = -w / 2 + 0.05 + ((w - 0.1) * (k + 0.5)) / 6;
    parts.push(span('grille', [x - (w - 0.1) / 15, x + (w - 0.1) / 15], [h, h + 0.0012], [vz0, vz0 + 0.012], o));
    parts.push(span('grille', [x - (w - 0.1) / 15, x + (w - 0.1) / 15], [h, h + 0.0012], [vz0 + 0.03, vz0 + 0.042], o));
  }
  // Back wire guard, base rails and drain plug.
  for (const k of range(clamp(Math.round(w / 0.06), 5, 10))) {
    const x = -w / 2 + 0.02 + ((w - 0.04) * (k + 0.5)) / clamp(Math.round(w / 0.06), 5, 10);
    parts.push(vcyl('grille', x, zb + 0.0015, 0.03, h - 0.015, 0.0012, o));
  }
  for (const y of [h * 0.33, h * 0.66]) parts.push(rod('grille', [-w / 2 + 0.01, y, zb + 0.0015], [w / 2 - 0.01, y, zb + 0.0015], 0.0012, o));
  for (const s of [-1, 1]) parts.push(span('body', [s * (w / 2 - 0.05) - 0.02, s * (w / 2 - 0.05) + 0.02], [0, 0.015], [zb + 0.02, fz0 - 0.01], { bevel: 0.002 }));
  parts.push(rod('grille', [w * 0.25, 0.02, zb + 0.02], [w * 0.25, 0.02, zb + 0.005], 0.008, { segments: 10, plan: false }));
  return parts;
}

/**
 * Wall bracket for an outdoor unit (giá đỡ cục nóng): two welded angle-iron brackets bolted to the
 * wall (back at -z), each an upright, a horizontal arm and a diagonal brace, with rubber
 * anti-vibration pads where the unit's rails sit, end caps, anchor bolts and a front tie bar.
 * Slots: steel, pads, bolts.
 */
export function wallBracket({ w, d, h }: Size3): Part[] {
  const zb = -d / 2;
  const ya = h - 0.022; // arm top (pads above)
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    const x = s * (w / 2 - 0.022);
    parts.push(
      // Upright: flange on the wall and the web standing out from it.
      span('steel', [x - 0.02, x + 0.02], [0, ya], [zb, zb + 0.004]),
      span('steel', [x - 0.002, x + 0.002], [0, ya - 0.004], [zb + 0.004, zb + 0.04], o),
      // Arm: top flange and the web below it.
      span('steel', [x - 0.02, x + 0.02], [ya - 0.004, ya], [zb + 0.004, d / 2 - 0.012]),
      span('steel', [x - 0.002, x + 0.002], [ya - 0.04, ya - 0.004], [zb + 0.04, d / 2 - 0.012], o),
      // Diagonal brace from the foot of the upright to the arm.
      rod('steel', [x, 0.03, zb + 0.03], [x, ya - 0.035, zb + Math.min(d * 0.72, (ya - 0.065) * 1.1 + 0.03)], 0.007, { segments: 8, plan: false }),
      // Plastic end cap.
      span('pads', [x - 0.021, x + 0.021], [ya - 0.042, ya + 0.001], [d / 2 - 0.012, d / 2], { bevel: 0.003, plan: false }),
    );
    // Rubber pads where the unit's rails rest.
    for (const z of [zb + d * 0.32, zb + d * 0.78]) parts.push(span('pads', [x - 0.019, x + 0.019], [ya, h], [z - 0.03, z + 0.03], { bevel: 0.003, plan: false }));
    // Expansion anchor bolts through the wall flange: washer and hex nut.
    for (const y of [0.05, ya - 0.06]) {
      parts.push(discZ('bolts', [x - 0.011 * s, y, zb + 0.005], 0.011, 0.002, { segments: 16, plan: false }));
      parts.push(discZ('bolts', [x - 0.011 * s, y, zb + 0.01], 0.008, 0.008, { segments: 6, plan: false }));
      parts.push(discZ('bolts', [x - 0.011 * s, y, zb + 0.016], 0.004, 0.006, { segments: 8, plan: false }));
    }
  }
  // Tie bar across the arms near the front.
  parts.push(span('steel', [-w / 2 + 0.042, w / 2 - 0.042], [ya - 0.034, ya - 0.012], [d / 2 - 0.07, d / 2 - 0.066]));
  return parts;
}

/**
 * Rooftop / floor stand for an outdoor unit (giá đặt sàn): two concrete sleepers, a galvanised steel
 * frame of four posts with base plates, front and back top rails carrying rubber pads, side rails
 * and diagonal braces. Slots: frame, pads, base.
 */
export function rooftopStand({ w, d, h }: Size3): Part[] {
  const hb = Math.min(0.06, h * 0.2); // sleeper height
  const yr = h - 0.02; // top of the rails (pads above)
  const px = w / 2 - 0.08;
  const pz = d / 2 - 0.05;
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    parts.push(span('base', [s * px - 0.075, s * px + 0.075], [0, hb], [-d / 2, d / 2], { bevel: 0.006 }));
    // Side rail at mid height and a diagonal brace between the posts.
    parts.push(span('frame', [s * px - 0.015, s * px + 0.015], [hb + 0.04, hb + 0.07], [-pz, pz], o));
    parts.push(rod('frame', [s * px, hb + 0.07, -pz + 0.02], [s * px, yr - 0.05, pz - 0.02], 0.006, { segments: 6, plan: false }));
    for (const z of [-pz, pz]) {
      parts.push(span('frame', [s * px - 0.045, s * px + 0.045], [hb, hb + 0.006], [z - 0.045, z + 0.045], o));
      parts.push(span('frame', [s * px - 0.02, s * px + 0.02], [hb + 0.006, yr - 0.04], [z - 0.02, z + 0.02], o));
      for (const k of [-1, 1]) parts.push(vcyl('frame', s * px + k * 0.033, z + k * 0.033, hb + 0.006, hb + 0.016, 0.006, { segments: 6, plan: false }));
    }
  }
  for (const z of [-pz, pz]) {
    // Top rail (C-channel) across the width, with two rubber pads on it.
    parts.push(span('frame', [-w / 2, w / 2], [yr - 0.04, yr], [z - 0.025, z + 0.025], { bevel: 0.002 }));
    for (const s of [-1, 1]) parts.push(span('pads', [s * (w / 2 - 0.2) - 0.035, s * (w / 2 - 0.2) + 0.035], [yr, h], [z - 0.023, z + 0.023], { bevel: 0.003, plan: false }));
  }
  return parts;
}

/** Condenser coil textures and casing colours shared by the AC packs. */
export const AC_PATTERNS: PackPattern[] = [
  {
    id: 'coil-fins',
    name: 'Condenser coil fins',
    normalStrength: 0.9,
    draw(ctx, size) {
      ctx.fillStyle = '#d9dcdf';
      ctx.fillRect(0, 0, size, size);
      const n = 64;
      for (let i = 0; i < n; i++) {
        const x = (i * size) / n;
        ctx.fillStyle = '#9da3a8';
        ctx.fillRect(Math.round(x), 0, Math.max(1, Math.round(size / n / 3)), size);
      }
      // Copper return bends of the tubes, every few centimetres.
      ctx.fillStyle = '#b8bcc0';
      for (let j = 0; j < 8; j++) ctx.fillRect(0, Math.round(((j + 0.5) * size) / 8) - 1, size, 3);
    },
  },
  {
    id: 'coil-louvre',
    name: 'Louvred condenser fins',
    normalStrength: 1.1,
    draw(ctx, size) {
      ctx.fillStyle = '#dde0e3';
      ctx.fillRect(0, 0, size, size);
      const n = 48;
      const fw = size / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = '#979ea4';
        ctx.fillRect(Math.round(i * fw), 0, Math.max(1, Math.round(fw / 3)), size);
      }
      // Lanced louvres between the fins: short slanted slits in rows.
      const rows = 32;
      for (let j = 0; j < rows; j++) {
        const y = Math.round(((j + 0.5) * size) / rows);
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = j % 4 === 0 ? '#c3c8cc' : '#b0b6bb';
          ctx.fillRect(Math.round(i * fw + fw * 0.4), y, Math.max(1, Math.round(fw * 0.5)), 1);
        }
      }
      // Tube rows.
      ctx.fillStyle = '#eceef0';
      for (let j = 0; j < 8; j++) ctx.fillRect(0, Math.round(((j + 0.5) * size) / 8) - 1, size, 2);
    },
  },
  {
    id: 'galv-spangle',
    name: 'Galvanised spangle',
    normalStrength: 0.15,
    draw(ctx, size, rand) {
      ctx.fillStyle = '#e4e6e8';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 90; i++) {
        const x = rand() * size;
        const y = rand() * size;
        const r = size * (0.03 + rand() * 0.07);
        const g = Math.round(205 + rand() * 50);
        ctx.fillStyle = `rgb(${g},${g},${g + 2 > 255 ? 255 : g + 2})`;
        for (const ox of [-size, 0, size]) {
          for (const oy of [-size, 0, size]) {
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
              const a = (k / 6) * Math.PI * 2 + i;
              const rr = r * (0.7 + 0.3 * Math.sin(i * 3 + k));
              ctx.lineTo(x + ox + Math.cos(a) * rr, y + oy + Math.sin(a) * rr);
            }
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    },
  },
];

export const AC_MATERIALS: PackMaterial[] = [
  { id: 'climate-casing', name: 'Outdoor unit casing', category: 'metal', color: '#eeede8', roughness: 0.45, metalness: 0.1 },
  { id: 'climate-casing-ivory', name: 'Outdoor unit casing, warm ivory', category: 'metal', color: '#e9e4d6', roughness: 0.45, metalness: 0.1 },
  { id: 'climate-casing-grey', name: 'Outdoor unit casing, light grey', category: 'metal', color: '#cfd2d3', roughness: 0.45, metalness: 0.15 },
  { id: 'climate-casing-charcoal', name: 'Outdoor unit casing, charcoal', category: 'metal', color: '#4c5155', roughness: 0.5, metalness: 0.2 },
  { id: 'climate-fan-charcoal', name: 'Charcoal fan plastic', category: 'solid', color: '#303336', roughness: 0.55, metalness: 0.1 },
  { id: 'climate-coil', name: 'Aluminium condenser coil', category: 'metal', color: '#9ca1a6', roughness: 0.4, metalness: 0.6, pattern: { id: 'coil-fins', scale: 0.12, contrast: 1 } },
  { id: 'climate-coil-louvre', name: 'Louvred aluminium coil', category: 'metal', color: '#9ca1a6', roughness: 0.4, metalness: 0.6, pattern: { id: 'coil-louvre', scale: 0.1, contrast: 1 } },
  { id: 'climate-coil-blue', name: 'Blue-fin coated coil', category: 'metal', color: '#7e95ab', roughness: 0.4, metalness: 0.45, pattern: { id: 'coil-louvre', scale: 0.1, contrast: 1 } },
  { id: 'climate-coil-gold', name: 'Gold-fin coated coil', category: 'metal', color: '#a08b5a', roughness: 0.4, metalness: 0.5, pattern: { id: 'coil-louvre', scale: 0.1, contrast: 1 } },
  { id: 'climate-galvanised', name: 'Galvanised steel', category: 'metal', color: '#c5cacd', roughness: 0.45, metalness: 0.6, pattern: { id: 'galv-spangle', scale: 0.25, contrast: 0.6 } },
];

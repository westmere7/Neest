import type { AssetDefinition, Part, PlanStroke, Size3 } from './types';
import {
  arcPoints,
  blobCluster,
  box,
  cellSpans,
  cells,
  circle,
  clamp,
  cyl,
  defineAsset,
  discZ,
  foliage,
  frame4,
  fronts,
  lathe,
  line,
  matSlot,
  poly,
  prism,
  range,
  rectPoly,
  ring,
  rng,
  rod,
  rodPath,
  rodX,
  rodZ,
  span,
  spaced,
  sphere,
  torus,
  turnedLeg,
  vcyl,
  type FrontSpec,
  type PartOpts,
  type V2,
  type V3,
} from './parts';

// Hobbies & fitness: music, exercise, games, creative and knowledge activities.

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

/** Prism whose outline is drawn in the Y/Z plane ([y, z] points), extruded along +x from x0 by `thick`. */
function sideProfile(slot: string, pts: V2[], x0: number, thick: number, opts?: PartOpts): Part {
  const ys = pts.map((p) => p[0]);
  const p = prism(
    slot,
    pts.map(([y, z]) => [-y, z] as V2),
    0,
    thick,
    opts,
  );
  p.rotation = [0, 0, -Math.PI / 2];
  p.position = [x0, (Math.min(...ys) + Math.max(...ys)) / 2, p.position[2]];
  return p;
}

/** Prism whose outline is drawn in the X/Y plane ([x, y] points), extruded towards +z from z0 by `thick`. */
function facePrism(slot: string, pts: V2[], z0: number, thick: number, opts?: PartOpts): Part {
  const ys = pts.map((p) => p[1]);
  const p = prism(
    slot,
    pts.map(([x, y]) => [x, -y] as V2),
    0,
    thick,
    opts,
  );
  p.rotation = [Math.PI / 2, 0, 0];
  p.position = [p.position[0], (Math.min(...ys) + Math.max(...ys)) / 2, z0];
  return p;
}

/** Three splayed tripod legs from a hub at (x, yTop, z) out to radius `r` on the floor. */
function tripod(slot: string, x: number, z: number, yTop: number, r: number, rad = 0.009, a0 = Math.PI / 2): Part[] {
  return [0, 1, 2].map((i) => {
    const a = a0 + (i * 2 * Math.PI) / 3;
    return rod(slot, [x, yTop, z], [x + Math.cos(a) * r, 0.008, z + Math.sin(a) * r], rad, { plan: false });
  });
}

const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];

// Piano keyboards ------------------------------------------------------------

const WHITE_KEY = 0.0235;
/** White-key indices (C = 0) followed by a black key. */
const BLACK_AFTER = new Set([0, 1, 3, 4, 5]);

function keyLayout(x: V2) {
  const n = clamp(Math.floor((x[1] - x[0]) / WHITE_KEY), 7, 52);
  // A full 88-key piano starts on A; shorter keyboards start on C.
  return { n, x0: (x[0] + x[1]) / 2 - (n * WHITE_KEY) / 2, start: n >= 52 ? 5 : 0 };
}

/** White-key bed plus individual black keys; key fronts at `zFront`, white key tops at y0 + 0.022. */
function keyboard(keysSlot: string, sharpsSlot: string, x: V2, y0: number, zFront: number, len: number): Part[] {
  const g = keyLayout(x);
  const parts: Part[] = [
    span(keysSlot, [g.x0, g.x0 + g.n * WHITE_KEY], [y0, y0 + 0.022], [zFront - len, zFront], {
      bevel: 0.002,
      plan: false,
    }),
  ];
  for (let i = 0; i < g.n - 1; i++) {
    if (!BLACK_AFTER.has((i + g.start) % 7)) continue;
    const cx = g.x0 + (i + 1) * WHITE_KEY;
    parts.push(
      span(sharpsSlot, [cx - 0.0065, cx + 0.0065], [y0 + 0.018, y0 + 0.034], [zFront - len, zFront - len * 0.36], {
        bevel: 0.002,
        plan: false,
      }),
    );
  }
  return parts;
}

function keyboardPlan(x: V2, zFront: number, len: number): PlanStroke[] {
  const g = keyLayout(x);
  const out: PlanStroke[] = [rectPoly(g.x0, zFront - len, g.x0 + g.n * WHITE_KEY, zFront)];
  for (let i = 1; i < g.n; i++) {
    if ((i + g.start) % 7 !== 0) continue;
    const kx = g.x0 + i * WHITE_KEY;
    out.push(line([kx, zFront - len], [kx, zFront]));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Music
// ---------------------------------------------------------------------------

function uprightGeom({ w, d, h }: Size3) {
  const caseD = clamp(d * 0.6, 0.28, 0.42);
  const zc = -d / 2 + caseD;
  const armW = 0.07;
  const zk = d / 2 - 0.02;
  return {
    ct: h - 0.13,
    caseD,
    zc,
    armW,
    ky: 0.72,
    zk,
    xi: [-w / 2 + armW, w / 2 - armW] as V2,
    keyLen: Math.min(0.15, zk - zc - 0.04),
  };
}

const pianoUpright = defineAsset({
  id: 'piano-upright',
  name: 'Upright piano',
  category: 'hobbies',
  type: 'activities',
  group: 'Music',
  tags: ['piano', 'upright', 'music', 'instrument', 'keys', 'keyboard'],
  defaultSize: { w: 1.5, d: 0.6, h: 1.25 },
  minSize: { w: 1.3, d: 0.5, h: 1.1 },
  maxSize: { w: 1.65, d: 0.72, h: 1.4 },
  wallSnap: true,
  slots: [
    matSlot('case', 'Case', 'laminate-black'),
    matSlot('keys', 'White keys & sheet music', 'plastic-white'),
    matSlot('sharps', 'Black keys', 'plastic-black'),
    matSlot('metal', 'Pedals & brass', 'metal-brass'),
  ],
  build: (size) => {
    const { w, d } = size;
    const g = uprightGeom(size);
    const { ct, zc, armW, ky, zk, xi } = g;
    const deskH = clamp(ct - 0.06 - (ky + 0.15), 0.08, 0.26);
    const mw = Math.min(0.7, w * 0.45);
    const tilt = 0.18;
    const nrm: V3 = [0, Math.sin(tilt), Math.cos(tilt)];
    const deskC: V3 = [0, ky + 0.15 + deskH / 2, zc + 0.03];
    const parts: Part[] = [
      // Upper case, overhanging top lid and plinth
      span('case', [-w / 2 + 0.01, w / 2 - 0.01], [0.05, ct - 0.03], [-d / 2, zc], { bevel: 0.008 }),
      span('case', [-w / 2, w / 2], [ct - 0.03, ct], [-d / 2, zc + 0.025], { bevel: 0.01 }),
      span('case', [-w / 2 + 0.01, w / 2 - 0.01], [0, 0.06], [-d / 2, zc + 0.03], { bevel: 0.005, plan: false }),
      // Keybed and key slip
      span('case', xi, [0.64, ky], [zc, zk], { plan: false }),
      span('case', xi, [0.64, ky + 0.012], [zk, d / 2], { bevel: 0.004, plan: false }),
      ...keyboard('keys', 'sharps', [xi[0] + 0.005, xi[1] - 0.005], ky, zk, g.keyLen),
      // Open fallboard with a brass name plate
      span('case', xi, [ky + 0.01, ky + 0.11], [zc, zc + 0.035], { bevel: 0.005, plan: false }),
      span('metal', [-0.06, 0.06], [ky + 0.06, ky + 0.075], [zc + 0.035, zc + 0.038], { plan: false }),
      // Knee board with moulding
      span('case', [xi[0] + 0.02, xi[1] - 0.02], [0.1, 0.6], [zc, zc + 0.012], { plan: false }),
      ...frame4('case', [xi[0] + 0.06, xi[1] - 0.06], [0.16, 0.54], [zc + 0.012, zc + 0.022], 0.025),
      // Music desk with two pages of sheet music
      span('case', [-mw / 2, mw / 2], [ky + 0.13, ky + 0.15], [zc, zc + 0.06], { bevel: 0.004, plan: false }),
      box('case', deskC, [mw, deskH, 0.012], { rotation: [-tilt, 0, 0], plan: false }),
    ];
    for (const sx of [-1, 1]) {
      parts.push(
        box('keys', add([sx * mw * 0.17, deskC[1] + 0.005, deskC[2]], nrm, 0.008), [mw * 0.31, deskH * 0.82, 0.002], {
          rotation: [-tilt, 0, 0],
          plan: false,
        }),
      );
    }
    // Moulded upper panel (only when there is room above the desk)
    const panelY: V2 = [ky + 0.14, ct - 0.06];
    if (panelY[1] - panelY[0] > 0.12) {
      parts.push(...frame4('case', [-w / 2 + 0.14, w / 2 - 0.14], panelY, [zc, zc + 0.01], 0.025));
    }
    // Arms (cheeks), turned front legs and toe blocks
    for (const s of [-1, 1]) {
      const xa: V2 = s < 0 ? [-w / 2, -w / 2 + armW] : [w / 2 - armW, w / 2];
      parts.push(
        span('case', xa, [0.6, ky + 0.09], [zc, d / 2], { bevel: 0.012 }),
        turnedLeg('case', s * (w / 2 - armW / 2), d / 2 - 0.045, 0.06, 0.6, 0.03, { style: 'taper' }),
        span('case', [xa[0] + 0.005, xa[1] - 0.005], [0, 0.06], [zc, d / 2 - 0.01], { bevel: 0.01, plan: false }),
      );
    }
    // Three pedals
    for (const x of [-0.07, 0, 0.07]) {
      parts.push(span('metal', [x - 0.015, x + 0.015], [0.06, 0.075], [zc + 0.03, zc + 0.13], { bevel: 0.004, plan: false }));
    }
    // A metronome and a framed photo on top
    const mx = w / 2 - 0.22;
    const mz = -d / 2 + g.caseD / 2;
    parts.push(
      lathe('case', [mx, ct, mz], [
        [0, 0],
        [0.05, 0],
        [0.012, 0.11],
        [0, 0.115],
      ], { segments: 4, plan: false }),
      rod('metal', [mx, ct + 0.02, mz + 0.047], [mx + 0.015, ct + 0.095, mz + 0.022], 0.003, { plan: false }),
    );
    const pc: V3 = [-w / 2 + 0.25, ct + 0.056, -d / 2 + g.caseD * 0.4];
    const pn: V3 = [0, Math.sin(0.2), Math.cos(0.2)];
    parts.push(
      box('metal', pc, [0.12, 0.1, 0.012], { rotation: [-0.2, 0, 0], plan: false }),
      box('keys', add(pc, pn, 0.0065), [0.09, 0.072, 0.002], { rotation: [-0.2, 0, 0], plan: false }),
    );
    return parts;
  },
  planDetail: (size) => {
    const g = uprightGeom(size);
    return [line([g.xi[0], g.zc], [g.xi[1], g.zc]), ...keyboardPlan([g.xi[0] + 0.005, g.xi[1] - 0.005], g.zk, g.keyLen)];
  },
});

function grandGeom({ w, d, h }: Size3) {
  const zKb = d / 2 - 0.25;
  const L = zKb + d / 2;
  const ct = Math.min(1.0, h - 0.03);
  const A: V2 = [w / 2, zKb - 0.22 * L];
  const rT = clamp(w * 0.3, 0.3, 0.5);
  const cT: V2 = [-w / 2 + rT, -d / 2 + rT];
  const a1 = 1.5 * Math.PI + 0.85;
  const E: V2 = [cT[0] + Math.cos(a1) * rT, cT[1] + Math.sin(a1) * rT];
  const len = Math.hypot(E[0] - A[0], E[1] - A[1]);
  const ux = (E[0] - A[0]) / len;
  const uz = (E[1] - A[1]) / len;
  // Control point pulled in towards the spine: the concave "bentside".
  const C: V2 = [(A[0] + E[0]) / 2 + uz * 0.12 * w, (A[1] + E[1]) / 2 - ux * 0.12 * w];
  const bent = range(7).map((i) => {
    const t = (i + 1) / 8;
    const s = 1 - t;
    return [s * s * A[0] + 2 * s * t * C[0] + t * t * E[0], s * s * A[1] + 2 * s * t * C[1] + t * t * E[1]] as V2;
  });
  const outline: V2[] = [[-w / 2, zKb], [w / 2, zKb], A, ...bent, ...arcPoints(cT[0], cT[1], rT, a1, Math.PI, 10)];
  return { zKb, L, ct, rb: ct - 0.32, cT, outline };
}

const pianoGrand = defineAsset({
  id: 'piano-grand',
  name: 'Grand piano',
  category: 'hobbies',
  type: 'activities',
  group: 'Music',
  tags: ['piano', 'grand', 'baby grand', 'music', 'instrument', 'keys'],
  defaultSize: { w: 1.5, d: 1.9, h: 1.6 },
  minSize: { w: 1.4, d: 1.5, h: 1.0 },
  maxSize: { w: 1.6, d: 2.8, h: 1.9 },
  slots: [
    matSlot('case', 'Case', 'laminate-black'),
    matSlot('keys', 'White keys & sheet music', 'plastic-white'),
    matSlot('sharps', 'Black keys', 'plastic-black'),
    matSlot('metal', 'Plate, pedals & casters', 'metal-brass'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const { zKb, L, ct, rb, cT, outline } = grandGeom(size);
    const cheek = 0.07;
    const xi: V2 = [-w / 2 + cheek, w / 2 - cheek];
    const zk = d / 2 - 0.02;
    const czm = (zKb - d / 2) / 2;
    const plate = outline.map(([x, z]) => [x * 0.88, czm + (z - czm) * 0.9] as V2);
    const parts: Part[] = [
      prism('case', outline, rb, ct - rb),
      prism('metal', plate, ct, 0.005, { plan: false }),
      // Damper rail over the strings
      span('case', [-w / 2 + 0.08, w / 2 - 0.08], [ct, ct + 0.015], [zKb - 0.2, zKb - 0.12], { plan: false }),
      // Keybed, key slip, keys and fallboard
      span('case', xi, [0.62, 0.7], [zKb, zk], { plan: false }),
      span('case', xi, [0.62, 0.712], [zk, d / 2], { bevel: 0.004, plan: false }),
      ...keyboard('keys', 'sharps', [xi[0] + 0.005, xi[1] - 0.005], 0.7, zk, 0.15),
      span('case', xi, [0.7, 0.79], [zKb, zk - 0.15], { bevel: 0.005, plan: false }),
      // Pedal lyre
      span('case', [-0.05, 0.05], [0.12, rb], [zKb - 0.11, zKb - 0.09], { plan: false }),
      rod('case', [-0.09, 0.12, zKb - 0.1], [-0.05, rb, zKb - 0.1], 0.012, { plan: false }),
      rod('case', [0.09, 0.12, zKb - 0.1], [0.05, rb, zKb - 0.1], 0.012, { plan: false }),
      span('case', [-0.13, 0.13], [0.05, 0.12], [zKb - 0.15, zKb - 0.04], { bevel: 0.01, plan: false }),
    ];
    for (const x of [-0.05, 0, 0.05]) {
      parts.push(span('metal', [x - 0.013, x + 0.013], [0.065, 0.078], [zKb - 0.04, zKb + 0.07], { bevel: 0.004, plan: false }));
    }
    for (const s of [-1, 1]) {
      parts.push(span('case', s < 0 ? [-w / 2, -w / 2 + cheek] : [w / 2 - cheek, w / 2], [0.6, 0.8], [zKb - 0.02, d / 2], { bevel: 0.015 }));
    }
    // Three legs on brass caster cups
    const legs: V2[] = [
      [-w / 2 + 0.13, zKb - 0.07],
      [w / 2 - 0.13, zKb - 0.07],
      [cT[0] + 0.05, cT[1]],
    ];
    for (const [x, z] of legs) {
      parts.push(
        turnedLeg('case', x, z, 0.05, rb, 0.06, { style: 'taper' }),
        vcyl('metal', x, z, 0, 0.05, 0.035, { plan: false }),
      );
    }
    // Round holes in the cast-iron plate
    for (const [x, z] of [
      [-w / 2 + 0.2 * w, zKb - 0.35 * L],
      [-w / 2 + 0.2 * w, zKb - 0.6 * L],
      [-w / 2 + 0.42 * w, zKb - 0.3 * L],
    ] as V2[]) {
      parts.push(vcyl('case', x, z, ct + 0.002, ct + 0.007, 0.035, { plan: false }));
    }
    // Lid hinged along the straight (bass) side, propped open on a stick
    const sinA = clamp((h - ct - 0.03) / w, 0, 0.56);
    const a = Math.asin(sinA);
    const lid = prism('case', outline, ct, 0.018, { plan: false });
    if (a > 0.01) {
      lid.rotation = [0, 0, a];
      lid.position = [-w / 2 + (w / 2) * Math.cos(a), ct + (w / 2) * sinA, lid.position[2]];
    }
    parts.push(lid);
    if (a > 0.08) {
      const s = 0.8 * w;
      const zp = zKb - 0.1 * L;
      const top: V3 = [-w / 2 + s * Math.cos(a), ct + s * sinA - 0.01, zp];
      parts.push(rod('case', [top[0] + 0.03, ct, zp], top, 0.008, { plan: false }));
    }
    // Music desk with sheet music
    const deskH = clamp(h - ct - 0.05, 0, 0.26);
    if (deskH > 0.08) {
      const mw = Math.min(0.75, w * 0.5);
      const c: V3 = [0, ct + 0.01 + deskH / 2, zKb - 0.07];
      const n: V3 = [0, Math.sin(0.22), Math.cos(0.22)];
      parts.push(box('case', c, [mw, deskH, 0.015], { rotation: [-0.22, 0, 0], plan: false }));
      for (const sx of [-1, 1]) {
        parts.push(
          box('keys', add([sx * mw * 0.17, c[1], c[2]], n, 0.009), [mw * 0.31, deskH * 0.8, 0.002], {
            rotation: [-0.22, 0, 0],
            plan: false,
          }),
        );
      }
    }
    return parts;
  },
  planDetail: (size) => {
    const { w, d } = size;
    const { zKb, outline } = grandGeom(size);
    return [poly(outline), ...keyboardPlan([-w / 2 + 0.075, w / 2 - 0.075], d / 2 - 0.02, 0.15), line([-w / 2, zKb], [w / 2, zKb])];
  },
});

const guitarStand = defineAsset({
  id: 'guitar-stand',
  name: 'Guitar on stand',
  category: 'hobbies',
  type: 'activities',
  group: 'Music',
  tags: ['guitar', 'acoustic', 'instrument', 'music', 'stand'],
  defaultSize: { w: 0.42, d: 0.4, h: 1.05 },
  minSize: { w: 0.36, d: 0.34, h: 0.95 },
  maxSize: { w: 0.5, d: 0.5, h: 1.15 },
  slots: [
    matSlot('body', 'Guitar body', 'wood-teak'),
    matSlot('neck', 'Neck & fittings', 'wood-walnut'),
    matSlot('stand', 'Stand', 'metal-black-matte'),
    matSlot('strings', 'Strings & tuners', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.2;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const by = 0.11;
    const bz = 0.05;
    const k = Math.min(1, (h - by - 0.03) / ct);
    // Point `m` metres up the guitar's axis, `off` metres in front of its centre plane.
    const at = (m: number, off = 0): V3 => [0, by + m * ct + off * st, bz - m * st + off * ct];
    const tilt: V3 = [Math.PI / 2 - t, 0, 0];
    const back: V3 = [-t, 0, 0];
    const bd = 0.1;
    const r1 = Math.min(0.19 * k, w / 2 - 0.012);
    const r2 = r1 * 0.77;
    const mB = 2 * r1 + 1.35 * r2;
    const mN = 0.83 * k;
    const parts: Part[] = [
      cyl('body', at(r1), r1, bd, { rotation: tilt }),
      cyl('body', at(2 * r1 + 0.35 * r2), r2, bd, { rotation: tilt }),
      // Sound hole, rosette and bridge
      cyl('neck', at(2 * r1 - 0.01, bd / 2), 0.042 * k, 0.004, { rotation: tilt, plan: false }),
      torus('strings', at(2 * r1 - 0.01, bd / 2 + 0.001), 0.05 * k, 0.004, { rotation: back, plan: false }),
      box('neck', at(r1 * 0.7, bd / 2 + 0.004), [0.14 * k, 0.022, 0.008], { rotation: back, plan: false }),
      // Neck and angled headstock
      box('neck', at((mB + mN) / 2 - 0.01, bd / 2 - 0.012), [0.05, mN - mB + 0.02, 0.024], { rotation: back, plan: false }),
      box('neck', at(mN + 0.085 * k, bd / 2 - 0.025), [0.075, 0.17 * k, 0.018], { rotation: [-t - 0.22, 0, 0], plan: false }),
    ];
    // Frets
    for (const m of spaced(6, mB + 0.02, mN - 0.02)) {
      parts.push(box('strings', at(m, bd / 2 + 0.001), [0.05, 0.003, 0.003], { rotation: back, plan: false }));
    }
    // Tuning pegs, three a side
    for (const m of spaced(3, mN + 0.04 * k, mN + 0.13 * k)) {
      const p = at(m, bd / 2 - 0.03);
      parts.push(rodX('strings', -0.037, -0.058, p[1], p[2], 0.005, { plan: false }));
      parts.push(rodX('strings', 0.037, 0.058, p[1], p[2], 0.005, { plan: false }));
    }
    // Six strings from bridge to nut
    const s0 = at(r1 * 0.7, bd / 2 + 0.009);
    const s1 = at(mN, bd / 2 + 0.003);
    for (const x of spaced(6, -0.019, 0.019)) {
      parts.push(rod('strings', [x, s0[1], s0[2]], [x * 0.75, s1[1], s1[2]], 0.001, { plan: false }));
    }
    // A-frame stand: tripod legs, a back post with a neck yoke and a padded cradle
    const hub: V3 = [0, 0.28, bz - 0.17];
    const yoke = at(mN - 0.08 * k, -0.035);
    const feet: V3[] = [
      [-w / 2 + 0.03, 0.012, d / 2 - 0.04],
      [w / 2 - 0.03, 0.012, d / 2 - 0.04],
      [0, 0.012, -d / 2 + 0.03],
    ];
    for (const f of feet) {
      parts.push(rod('stand', hub, f, 0.01, { plan: false }), sphere('stand', f, 0.013, { plan: false }));
    }
    parts.push(
      rod('stand', hub, yoke, 0.011, { plan: false }),
      rodX('stand', -0.03, 0.03, yoke[1], yoke[2], 0.008, { plan: false }),
      rod('stand', [-0.03, yoke[1], yoke[2]], [-0.03, yoke[1] + 0.05, yoke[2] + 0.01], 0.006, { plan: false }),
      rod('stand', [0.03, yoke[1], yoke[2]], [0.03, yoke[1] + 0.05, yoke[2] + 0.01], 0.006, { plan: false }),
    );
    for (const s of [-1, 1]) {
      const p0: V3 = [s * 0.06, 0.1, bz - 0.12];
      parts.push(
        rod('stand', hub, p0, 0.009, { plan: false }),
        ...rodPath('stand', [p0, [s * 0.1, 0.09, bz + 0.06], [s * 0.1, 0.14, bz + 0.09]], 0.01),
      );
    }
    return parts;
  },
});

/** Cymbal: a shallow cone with a bell, tipped `tilt` towards the front. */
function cymbal(c: V3, r: number, tilt: number): Part[] {
  const ax: V3 = [0, Math.cos(tilt), Math.sin(tilt)];
  return [
    cyl('cymbals', c, r, 0.012, { rTop: r * 0.25, rotation: [tilt, 0, 0], plan: false }),
    cyl('cymbals', add(c, ax, 0.014), r * 0.22, 0.02, { rTop: r * 0.05, rotation: [tilt, 0, 0], plan: false }),
  ];
}

/** Drum shell with a batter head and hoop; axis tipped `tilt` towards the front. */
function drum(c: V3, r: number, depth: number, tilt: number, plan = false): Part[] {
  const ax: V3 = [0, Math.cos(tilt), Math.sin(tilt)];
  return [
    cyl('shells', c, r, depth, { rotation: [tilt, 0, 0], plan }),
    cyl('heads', add(c, ax, depth / 2), r - 0.003, 0.006, { rotation: [tilt, 0, 0], plan: false }),
    torus('hardware', add(c, ax, depth / 2), r + 0.003, 0.008, { rotation: [tilt - Math.PI / 2, 0, 0], plan: false }),
  ];
}

function drumLayout({ w, d, h }: Size3) {
  const tz = d / 2 - 0.22;
  const zk = tz - 0.65;
  return {
    tz,
    zk,
    rk: 0.26,
    snare: [-0.3, 0.6, tz - 0.42] as V3,
    floorTom: [w / 2 - 0.27, tz - 0.38] as V2,
    hihat: [-w / 2 + 0.2, tz - 0.25] as V2,
    crash: [-w / 2 + 0.22, h - 0.1, zk] as V3,
    ride: [w / 2 - 0.26, h - 0.28, zk + 0.12] as V3,
  };
}

const drumKit = defineAsset({
  id: 'drum-kit',
  name: 'Drum kit',
  category: 'hobbies',
  type: 'activities',
  group: 'Music',
  tags: ['drums', 'drum kit', 'percussion', 'music', 'instrument', 'cymbals'],
  defaultSize: { w: 1.6, d: 1.4, h: 1.2 },
  minSize: { w: 1.3, d: 1.1, h: 1.0 },
  maxSize: { w: 2.0, d: 1.7, h: 1.4 },
  slots: [
    matSlot('shells', 'Drum shells', 'plastic-red'),
    matSlot('heads', 'Drum heads', 'plastic-white'),
    matSlot('hardware', 'Hardware', 'metal-chrome'),
    matSlot('cymbals', 'Cymbals & sticks', 'metal-brass'),
  ],
  build: (size) => {
    const L = drumLayout(size);
    const { tz, zk, rk } = L;
    const ky = rk + 0.025;
    const parts: Part[] = [
      // Throne
      vcyl('shells', 0, tz, 0.47, 0.54, 0.17),
      vcyl('hardware', 0, tz, 0.12, 0.47, 0.02, { plan: false }),
      ...tripod('hardware', 0, tz, 0.15, 0.2),
      // Bass drum with heads, hoops, logo and tube lugs
      discZ('shells', [0, ky, zk], rk, 0.38),
      discZ('shells', [0, ky, zk - 0.197], 0.09, 0.006, { plan: false }),
    ];
    for (const e of [-1, 1]) {
      parts.push(
        discZ('heads', [0, ky, zk + e * 0.19], rk - 0.004, 0.008, { plan: false }),
        torus('shells', [0, ky, zk + e * 0.195], rk + 0.002, 0.012, { plan: false }),
        rod('hardware', [e * rk * 0.9, ky - 0.05, zk - 0.1], [e * (rk + 0.08), 0.005, zk - 0.18], 0.008, { plan: false }),
      );
    }
    for (const a of cells(8, 0, Math.PI * 2)) {
      parts.push(rodZ('hardware', Math.cos(a) * (rk + 0.01), ky + Math.sin(a) * (rk + 0.01), zk - 0.17, zk + 0.17, 0.006, { plan: false }));
    }
    // Bass pedal and beater
    parts.push(
      span('hardware', [-0.05, 0.05], [0.005, 0.035], [zk + 0.2, zk + 0.45], { plan: false }),
      rod('hardware', [0, 0.03, zk + 0.23], [0, 0.25, zk + 0.25], 0.006, { plan: false }),
      sphere('heads', [0, 0.25, zk + 0.22], 0.025, { plan: false }),
    );
    // Two rack toms on the bass drum
    for (const s of [-1, 1]) {
      const r = s < 0 ? 0.12 : 0.13;
      const c: V3 = [s * 0.16, ky + rk + 0.22, zk + 0.08];
      parts.push(...drum(c, r, 0.2, 0.45), rod('hardware', [s * 0.05, ky + rk, zk], [c[0], c[1] - 0.08, c[2] - 0.03], 0.012, { plan: false }));
    }
    // Snare on its stand, with a pair of sticks resting on it
    const sn = L.snare;
    parts.push(
      ...drum(sn, 0.18, 0.14, 0.12, true),
      rod('hardware', [sn[0], 0.12, sn[2]], [sn[0], sn[1] - 0.07, sn[2]], 0.009, { plan: false }),
      ...tripod('hardware', sn[0], sn[2], 0.15, 0.2),
      rod('cymbals', [sn[0] - 0.12, sn[1] + 0.1, sn[2] + 0.05], [sn[0] + 0.15, sn[1] + 0.1, sn[2] - 0.02], 0.007, { plan: false }),
      rod('cymbals', [sn[0] - 0.12, sn[1] + 0.1, sn[2] + 0.1], [sn[0] + 0.15, sn[1] + 0.1, sn[2] + 0.04], 0.007, { plan: false }),
    );
    // Floor tom on three legs
    const [fx, fz] = L.floorTom;
    parts.push(
      vcyl('shells', fx, fz, 0.23, 0.61, 0.2),
      vcyl('heads', fx, fz, 0.61, 0.617, 0.197, { plan: false }),
      ring('hardware', [fx, 0.614, fz], 0.203, 0.009, { plan: false }),
    );
    for (const a of [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2]) {
      parts.push(rod('hardware', [fx + Math.cos(a) * 0.21, 0.5, fz + Math.sin(a) * 0.21], [fx + Math.cos(a) * 0.25, 0.005, fz + Math.sin(a) * 0.25], 0.008, { plan: false }));
    }
    // Hi-hat: two cymbals on a pedal stand
    const [hx, hz] = L.hihat;
    parts.push(
      ...cymbal([hx, 0.92, hz], 0.18, 0),
      ...cymbal([hx, 0.89, hz], 0.18, 0),
      rod('hardware', [hx, 0.12, hz], [hx, 0.98, hz], 0.008, { plan: false }),
      ...tripod('hardware', hx, hz, 0.15, 0.18),
      span('hardware', [hx - 0.04, hx + 0.04], [0.005, 0.03], [hz + 0.05, hz + 0.24], { plan: false }),
    );
    // Crash and ride on boom stands
    const cr = L.crash;
    parts.push(
      ...cymbal(cr, 0.2, 0.3),
      rod('hardware', [cr[0] + 0.05, 0.14, zk + 0.05], [cr[0], cr[1] - 0.03, cr[2]], 0.009, { plan: false }),
      ...tripod('hardware', cr[0] + 0.05, zk + 0.05, 0.15, 0.16),
    );
    const rd = L.ride;
    parts.push(
      ...cymbal(rd, 0.24, 0.2),
      rod('hardware', [rd[0] + 0.06, 0.14, rd[2]], [rd[0], rd[1] - 0.03, rd[2]], 0.009, { plan: false }),
      ...tripod('hardware', rd[0] + 0.06, rd[2], 0.15, 0.16),
    );
    return parts;
  },
  planDetail: (size) => {
    const L = drumLayout(size);
    return [
      circle([L.snare[0], L.snare[2]], 0.18),
      circle(L.floorTom, 0.2),
      circle(L.hihat, 0.18),
      circle([L.crash[0], L.crash[2]], 0.19),
      circle([L.ride[0], L.ride[2]], 0.23),
      circle([0, L.tz], 0.17),
      rectPoly(-L.rk, L.zk - 0.19, L.rk, L.zk + 0.19),
    ];
  },
});

const keyboardStand = defineAsset({
  id: 'keyboard-stand',
  name: 'Keyboard on stand',
  category: 'hobbies',
  type: 'activities',
  group: 'Music',
  tags: ['keyboard', 'synth', 'digital piano', 'music', 'instrument', 'stand'],
  defaultSize: { w: 1.1, d: 0.45, h: 0.98 },
  minSize: { w: 0.9, d: 0.35, h: 0.85 },
  maxSize: { w: 1.45, d: 0.6, h: 1.1 },
  slots: [
    matSlot('body', 'Keyboard body', 'plastic-black'),
    matSlot('keys', 'Keys & buttons', 'plastic-white'),
    matSlot('stand', 'Stand & grilles', 'metal-black-matte'),
    matSlot('display', 'Display', 'screen-glow'),
  ],
  build: ({ w, d, h }) => {
    const kTop = clamp(h - 0.16, 0.72, 0.9);
    const mr = Math.min(0.22, h - kTop);
    const kd = Math.min(0.34, d - 0.04);
    const keyLen = Math.min(0.14, kd - 0.15);
    const xa = Math.min(0.3, w / 2 - 0.12);
    const zs = Math.min(0.1, kd / 2 - 0.04);
    const parts: Part[] = [
      span('body', [-w / 2, w / 2], [kTop - 0.1, kTop - 0.025], [-kd / 2, kd / 2], { bevel: 0.015 }),
      span('body', [-w / 2, w / 2], [kTop - 0.03, kTop], [-kd / 2, -kd / 2 + 0.13], { bevel: 0.01, plan: false }),
      span('body', [-w / 2, -w / 2 + 0.06], [kTop - 0.1, kTop - 0.01], [-kd / 2, kd / 2], { bevel: 0.012, plan: false }),
      span('body', [w / 2 - 0.06, w / 2], [kTop - 0.1, kTop - 0.01], [-kd / 2, kd / 2], { bevel: 0.012, plan: false }),
      ...keyboard('keys', 'body', [-w / 2 + 0.065, w / 2 - 0.065], kTop - 0.045, kd / 2 - 0.012, keyLen),
      // Display, speaker grilles, buttons and knobs on the control panel
      span('display', [-0.08, 0.08], [kTop, kTop + 0.003], [-kd / 2 + 0.035, -kd / 2 + 0.09], { plan: false }),
      span('stand', [-w / 2 + 0.07, -w / 2 + 0.25], [kTop, kTop + 0.003], [-kd / 2 + 0.02, -kd / 2 + 0.11], { plan: false }),
      span('stand', [w / 2 - 0.25, w / 2 - 0.07], [kTop, kTop + 0.003], [-kd / 2 + 0.02, -kd / 2 + 0.11], { plan: false }),
    ];
    for (const x of [...spaced(4, -0.21, -0.11), ...spaced(4, 0.11, 0.21)]) {
      parts.push(span('keys', [x - 0.009, x + 0.009], [kTop, kTop + 0.006], [-kd / 2 + 0.07, -kd / 2 + 0.085], { plan: false }));
    }
    for (const x of [-0.17, -0.13]) parts.push(vcyl('keys', x, -kd / 2 + 0.035, kTop, kTop + 0.014, 0.01, { plan: false }));
    // Music rest with a song book
    if (mr > 0.06) {
      const rw = Math.min(0.6, w * 0.45);
      const c: V3 = [0, kTop + mr / 2 - 0.005, -kd / 2 + 0.05];
      parts.push(
        box('body', c, [rw, mr - 0.02, 0.01], { rotation: [-0.2, 0, 0], plan: false }),
        box('keys', add(c, [0, Math.sin(0.2), Math.cos(0.2)], 0.007), [rw * 0.55, (mr - 0.02) * 0.75, 0.003], {
          rotation: [-0.2, 0, 0],
          plan: false,
        }),
      );
    }
    // X-stand: crossed legs, support arms, floor feet with rubber caps
    for (const z of [-zs, zs]) {
      parts.push(
        rod('stand', [-xa, 0.03, z], [xa, kTop - 0.115, z], 0.016, { plan: false }),
        rod('stand', [xa, 0.03, z], [-xa, kTop - 0.115, z], 0.016, { plan: false }),
        discZ('stand', [0, (kTop - 0.085) / 2, z + Math.sign(z) * 0.02], 0.022, 0.02, { plan: false }),
      );
    }
    for (const x of [-xa, xa]) {
      parts.push(
        rodZ('stand', x, kTop - 0.115, -kd / 2 + 0.03, kd / 2 - 0.03, 0.014, { plan: false }),
        rodZ('stand', x, 0.03, -d / 2 + 0.04, d / 2 - 0.04, 0.016),
        sphere('body', [x, 0.03, -d / 2 + 0.03], 0.02, { plan: false }),
        sphere('body', [x, 0.03, d / 2 - 0.03], 0.02, { plan: false }),
      );
    }
    // Sustain pedal on the floor
    const px = Math.min(xa + 0.15, w / 2 - 0.1);
    parts.push(span('body', [px - 0.05, px + 0.05], [0, 0.03], [d / 2 - 0.17, d / 2 - 0.03], { bevel: 0.008, plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => {
    const kd = Math.min(0.34, d - 0.04);
    return keyboardPlan([-w / 2 + 0.065, w / 2 - 0.065], kd / 2 - 0.012, Math.min(0.14, kd - 0.15));
  },
});

// ---------------------------------------------------------------------------
// Fitness
// ---------------------------------------------------------------------------

const treadmill = defineAsset({
  id: 'treadmill',
  name: 'Treadmill',
  category: 'hobbies',
  type: 'activities',
  group: 'Fitness',
  tags: ['treadmill', 'running', 'fitness', 'gym', 'exercise', 'cardio'],
  defaultSize: { w: 0.85, d: 1.9, h: 1.4 },
  minSize: { w: 0.7, d: 1.6, h: 1.25 },
  maxSize: { w: 1.0, d: 2.2, h: 1.6 },
  slots: [
    matSlot('frame', 'Frame & console', 'metal-anthracite'),
    matSlot('belt', 'Belt & grips', 'rubber-black'),
    matSlot('trim', 'Trim', 'metal-brushed-steel'),
    matSlot('screen', 'Screen', 'screen-glow'),
  ],
  build: ({ w, d, h }) => {
    const zb = -d / 2;
    const deck = 0.2;
    const bw = Math.min(0.5, w - 0.3);
    const ux = w / 2 - 0.045;
    const up0: V2 = [0.25, zb + 0.35];
    const up1: V2 = [h - 0.22, zb + 0.12];
    const hb = clamp(h - 0.42, 0.85, 1.05);
    const zAt = (y: number) => up0[1] + ((y - up0[0]) / (up1[0] - up0[0])) * (up1[1] - up0[1]);
    const ta = 0.45;
    const cc: V3 = [0, h - 0.13, zb + 0.13];
    const n: V3 = [0, Math.sin(ta), Math.cos(ta)];
    const down: V3 = [0, -Math.cos(ta), Math.sin(ta)];
    const face = add(cc, n, 0.112);
    const parts: Part[] = [
      // Deck, running belt, side rails and rear roller
      span('frame', [-w / 2 + 0.06, w / 2 - 0.06], [0.04, deck - 0.01], [zb + 0.2, d / 2 - 0.02], { bevel: 0.025 }),
      span('belt', [-bw / 2, bw / 2], [deck - 0.01, deck + 0.006], [zb + 0.45, d / 2 - 0.06], { plan: false }),
      span('trim', [-w / 2 + 0.06, -bw / 2 - 0.005], [deck - 0.01, deck + 0.01], [zb + 0.45, d / 2 - 0.04], { bevel: 0.005, plan: false }),
      span('trim', [bw / 2 + 0.005, w / 2 - 0.06], [deck - 0.01, deck + 0.01], [zb + 0.45, d / 2 - 0.04], { bevel: 0.005, plan: false }),
      rodX('trim', -bw / 2 - 0.01, bw / 2 + 0.01, deck - 0.025, d / 2 - 0.045, 0.03, { plan: false }),
      // Motor hood
      span('frame', [-w / 2 + 0.04, w / 2 - 0.04], [0.04, 0.3], [zb + 0.12, zb + 0.48], { bevel: 0.06 }),
      // Console tipped towards the runner, with screen and buttons
      box('frame', cc, [w - 0.06, 0.16, 0.22], { rotation: [-ta, 0, 0], plan: false }),
      box('screen', add(face, down, -0.01), [w * 0.4, 0.08, 0.004], { rotation: [-ta, 0, 0], plan: false }),
    ];
    for (const x of spaced(6, -w * 0.3, w * 0.3)) {
      parts.push(box('trim', add([x, face[1], face[2]], down, 0.055), [0.035, 0.018, 0.006], { rotation: [-ta, 0, 0], plan: false }));
    }
    for (const s of [-1, 1]) {
      const x = s * ux;
      parts.push(
        // Upright and side handrail with a grip
        rod('frame', [x, up0[0], up0[1]], [x, up1[0], up1[1]], 0.03, { plan: false }),
        rodZ('frame', s * (w / 2 - 0.03), hb, zAt(hb), zb + 0.62, 0.02, { plan: false }),
        rodZ('belt', s * (w / 2 - 0.03), hb, zb + 0.4, zb + 0.6, 0.025, { plan: false }),
        rod('frame', [s * (w / 2 - 0.03), hb, zb + 0.62], [s * (w / 2 - 0.06), deck, zb + 0.62], 0.018, { plan: false }),
        // Feet
        span('belt', [x - 0.03, x + 0.02], [0, 0.04], [zb + 0.15, zb + 0.25], { plan: false }),
        span('belt', [x - 0.03, x + 0.02], [0, 0.04], [d / 2 - 0.12, d / 2 - 0.03], { plan: false }),
      );
    }
    // Safety key and a water bottle in the cup holder
    const bx = w / 2 - 0.12;
    const bz = zb + 0.28;
    const by = h - 0.3;
    parts.push(
      sphere('screen', add(face, down, 0.04), 0.012, { plan: false }),
      vcyl('frame', bx, bz, by - 0.02, by + 0.02, 0.045, { plan: false }),
      vcyl('trim', bx, bz, by - 0.015, by + 0.15, 0.035, { plan: false }),
      vcyl('belt', bx, bz, by + 0.15, by + 0.18, 0.02, { plan: false }),
    );
    return parts;
  },
  planDetail: ({ w, d }) => {
    const bw = Math.min(0.5, w - 0.3);
    return [rectPoly(-bw / 2, -d / 2 + 0.45, bw / 2, d / 2 - 0.06), line([-w / 2 + 0.04, -d / 2 + 0.48], [w / 2 - 0.04, -d / 2 + 0.48])];
  },
});

const exerciseBike = defineAsset({
  id: 'exercise-bike',
  name: 'Exercise bike',
  category: 'hobbies',
  type: 'activities',
  group: 'Fitness',
  tags: ['exercise bike', 'spin bike', 'cycling', 'fitness', 'gym', 'cardio'],
  defaultSize: { w: 0.55, d: 1.1, h: 1.25 },
  minSize: { w: 0.45, d: 0.9, h: 1.1 },
  maxSize: { w: 0.65, d: 1.3, h: 1.4 },
  slots: [
    matSlot('frame', 'Frame', 'metal-anthracite'),
    matSlot('trim', 'Flywheel & posts', 'metal-chrome'),
    matSlot('saddle', 'Saddle, grips & pedals', 'rubber-black'),
    matSlot('screen', 'Display', 'screen-glow'),
  ],
  build: ({ w, d, h }) => {
    const zf = -d / 2;
    const zr = d / 2;
    const sy = h - 0.36;
    const xb = Math.min(0.22, w / 2 - 0.03);
    const toX: V3 = [0, 0, Math.PI / 2];
    const fly: V3 = [0, 0.3, zf + 0.27];
    const crank: V3 = [0, 0.32, 0];
    const parts: Part[] = [
      // Base beam and stabilisers with end caps
      rodZ('frame', 0, 0.06, zf + 0.06, zr - 0.06, 0.03),
      rodX('frame', -w / 2 + 0.03, w / 2 - 0.03, 0.04, zf + 0.07, 0.035),
      rodX('frame', -w / 2 + 0.03, w / 2 - 0.03, 0.04, zr - 0.07, 0.035),
      // Seat tube, seat post and saddle
      rod('frame', [0, 0.06, 0.12 * d], [0, sy - 0.2, 0.22 * d], 0.032, { plan: false }),
      rod('trim', [0, sy - 0.22, 0.22 * d], [0, sy - 0.06, 0.25 * d], 0.018, { plan: false }),
      sphere('saddle', [0, sy - 0.035, 0.25 * d + 0.03], 0.5, { scale: [0.17, 0.07, 0.27], plan: false }),
      // Head tube, stem and bull-horn handlebar
      rod('frame', [0, 0.06, zf + 0.6], [0, h - 0.28, zf + 0.3], 0.034, { plan: false }),
      rod('trim', [0, h - 0.3, zf + 0.3], [0, h - 0.14, zf + 0.26], 0.02, { plan: false }),
      rodX('frame', -xb, xb, h - 0.14, zf + 0.26, 0.016, { plan: false }),
      // Console with display
      box('frame', [0, h - 0.08, zf + 0.22], [0.2, 0.12, 0.05], { rotation: [-0.5, 0, 0], plan: false }),
      box('screen', [0, h - 0.08 + 0.026 * Math.sin(0.5), zf + 0.22 + 0.026 * Math.cos(0.5)], [0.15, 0.08, 0.004], {
        rotation: [-0.5, 0, 0],
        plan: false,
      }),
      // Flywheel with hub cover, fork and chain guard
      cyl('trim', fly, 0.22, 0.05, { rotation: toX, plan: false }),
      cyl('frame', fly, 0.09, 0.07, { rotation: toX, plan: false }),
      span('frame', [0.05, 0.075], [0.22, 0.42], [fly[2], crank[2]], { bevel: 0.008, plan: false }),
      cyl('trim', [0.065, crank[1], crank[2]], 0.1, 0.01, { rotation: toX, plan: false }),
    ];
    for (const s of [-1, 1]) {
      parts.push(
        sphere('saddle', [s * (w / 2 - 0.03), 0.04, zf + 0.07], 0.03, { plan: false }),
        sphere('saddle', [s * (w / 2 - 0.03), 0.04, zr - 0.07], 0.03, { plan: false }),
        rod('frame', [s * 0.045, fly[1], fly[2]], [s * 0.03, 0.62, zf + 0.5], 0.014, { plan: false }),
        rodZ('saddle', s * xb, h - 0.14, zf + 0.28, zf + 0.45, 0.018, { plan: false }),
        rod('saddle', [s * xb, h - 0.14, zf + 0.45], [s * xb, h - 0.08, zf + 0.5], 0.018, { plan: false }),
      );
      // Crank arm and pedal (opposite sides 180° apart)
      const a = s > 0 ? 0.6 : 0.6 + Math.PI;
      const end: V3 = [s * 0.085, crank[1] + 0.17 * Math.sin(a), crank[2] + 0.17 * Math.cos(a)];
      parts.push(
        rod('trim', [s * 0.085, crank[1], crank[2]], end, 0.012, { plan: false }),
        box('saddle', [s * 0.13, end[1], end[2]], [0.09, 0.025, 0.06], { bevel: 0.006, plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ d }) => [rectPoly(-0.025, -d / 2 + 0.05, 0.025, -d / 2 + 0.49)],
});

const weightBench = defineAsset({
  id: 'weight-bench',
  name: 'Weight bench with barbell',
  category: 'hobbies',
  type: 'activities',
  group: 'Fitness',
  tags: ['weight bench', 'barbell', 'bench press', 'gym', 'fitness', 'weights', 'dumbbells'],
  defaultSize: { w: 1.7, d: 1.3, h: 1.15 },
  minSize: { w: 1.4, d: 1.1, h: 1.0 },
  maxSize: { w: 2.2, d: 1.6, h: 1.3 },
  slots: [
    matSlot('frame', 'Frame', 'metal-black-matte'),
    matSlot('pad', 'Bench pad', 'leather-black'),
    matSlot('bar', 'Bar & handles', 'metal-chrome'),
    matSlot('plates', 'Weight plates', 'rubber-black'),
  ],
  build: ({ w, d, h }) => {
    const zr = -d / 2 + 0.25;
    const by = h - 0.23;
    const ux = clamp(w / 2 - 0.48, 0.2, 0.55);
    const pz: V2 = [zr - 0.1, Math.min(d / 2 - 0.2, zr - 0.1 + 1.15)];
    const toX: V3 = [0, 0, Math.PI / 2];
    const parts: Part[] = [
      // Bench: padded top on a beam with two T-feet
      span('pad', [-0.14, 0.14], [0.37, 0.45], pz, { bevel: 0.03 }),
      span('frame', [-0.04, 0.04], [0.29, 0.37], [pz[0] + 0.1, pz[1] - 0.1], { plan: false }),
      // Rack: base, uprights, J-hooks and top tie bar
      span('frame', [-ux, ux], [0, 0.05], [zr - 0.07, zr - 0.01], { plan: false }),
      span('frame', [-ux - 0.03, ux + 0.03], [h - 0.17, h - 0.12], [zr - 0.07, zr - 0.01], { plan: false }),
      // Barbell
      rodX('bar', -w / 2 + 0.01, w / 2 - 0.01, by, zr, 0.014, { plan: false }),
    ];
    for (const z of [pz[0] + 0.18, pz[1] - 0.12]) {
      parts.push(
        span('frame', [-0.2, 0.2], [0, 0.04], [z - 0.03, z + 0.03], { plan: false }),
        span('frame', [-0.03, 0.03], [0.04, 0.29], [z - 0.03, z + 0.03], { plan: false }),
      );
    }
    for (const s of [-1, 1]) {
      const x = s * ux;
      parts.push(
        span('frame', [x - 0.03, x + 0.03], [0.04, h - 0.12], [zr - 0.07, zr - 0.01]),
        span('frame', [x - 0.03, x + 0.03], [0, 0.05], [-d / 2 + 0.02, zr + 0.25]),
        span('frame', [x - 0.025, x + 0.025], [by - 0.05, by - 0.02], [zr - 0.03, zr + 0.04], { plan: false }),
        span('frame', [x - 0.025, x + 0.025], [by - 0.02, by + 0.02], [zr + 0.03, zr + 0.045], { plan: false }),
        // Sleeve, plates and collar
        rodX('bar', s * (w / 2 - 0.42), s * (w / 2 - 0.01), by, zr, 0.025, { plan: false }),
        cyl('plates', [s * (w / 2 - 0.355), by, zr], 0.225, 0.05, { rotation: toX }),
        cyl('plates', [s * (w / 2 - 0.3), by, zr], 0.16, 0.035, { rotation: toX, plan: false }),
        cyl('bar', [s * (w / 2 - 0.27), by, zr], 0.035, 0.025, { rotation: toX, plan: false }),
        // A dumbbell on the floor
        rodX('bar', s * 0.42 - 0.1, s * 0.42 + 0.1, 0.07, d / 2 - 0.08, 0.014, { plan: false }),
        cyl('plates', [s * 0.42 - 0.12, 0.07, d / 2 - 0.08], 0.07, 0.06, { rotation: toX, segments: 6, plan: false }),
        cyl('plates', [s * 0.42 + 0.12, 0.07, d / 2 - 0.08], 0.07, 0.06, { rotation: toX, segments: 6, plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const zr = -d / 2 + 0.25;
    return [line([-w / 2 + 0.01, zr], [w / 2 - 0.01, zr])];
  },
});

const yogaMat = defineAsset({
  id: 'yoga-mat',
  name: 'Rolled-out yoga mat',
  category: 'hobbies',
  type: 'activities',
  group: 'Fitness',
  tags: ['yoga', 'mat', 'pilates', 'stretching', 'fitness', 'exercise'],
  defaultSize: { w: 0.61, d: 1.83, h: 0.1 },
  minSize: { w: 0.5, d: 1.5, h: 0.08 },
  maxSize: { w: 0.8, d: 2.2, h: 0.2 },
  slots: [
    matSlot('mat', 'Mat', 'plastic-mint'),
    matSlot('prop', 'Yoga blocks', 'cork'),
    matSlot('towel', 'Towel', 'fabric-white-cotton'),
  ],
  build: ({ w, d, h }) => {
    const rr = clamp(h * 0.4, 0.025, 0.045);
    const bh = Math.min(0.075, h - 0.01);
    return [
      span('mat', [-w / 2, w / 2], [0, 0.005], [-d / 2 + rr, d / 2], { bevel: 0.002 }),
      // The end still curls where it was rolled
      rodX('mat', -w / 2 + 0.002, w / 2 - 0.002, rr, -d / 2 + rr, rr),
      rodX('towel', -w / 2 + 0.003, w / 2 - 0.003, rr, -d / 2 + rr, rr * 0.35, { plan: false }),
      // Two cork blocks and a folded towel at the front
      span('prop', [w / 2 - 0.17, w / 2 - 0.02], [0.005, 0.005 + bh], [d / 2 - 0.3, d / 2 - 0.07], { bevel: 0.006, plan: false }),
      span('prop', [w / 2 - 0.34, w / 2 - 0.19], [0.005, 0.005 + bh * 0.66], [d / 2 - 0.28, d / 2 - 0.05], { bevel: 0.006, plan: false }),
      span('towel', [-w / 2 + 0.04, -w / 2 + 0.26], [0.005, 0.005 + Math.min(0.04, bh * 0.6)], [d / 2 - 0.32, d / 2 - 0.06], {
        bevel: 0.01,
        plan: false,
      }),
    ];
  },
  planDetail: ({ w, d }) => [line([-w / 2, -d / 2 + 0.09], [w / 2, -d / 2 + 0.09]), rectPoly(w / 2 - 0.17, d / 2 - 0.3, w / 2 - 0.02, d / 2 - 0.07)],
});

const punchingBag = defineAsset({
  id: 'punching-bag',
  name: 'Punching bag on stand',
  category: 'hobbies',
  type: 'activities',
  group: 'Fitness',
  tags: ['punching bag', 'boxing', 'heavy bag', 'gym', 'fitness', 'martial arts'],
  defaultSize: { w: 1.0, d: 1.2, h: 2.2 },
  minSize: { w: 0.9, d: 1.0, h: 2.0 },
  maxSize: { w: 1.3, d: 1.5, h: 2.4 },
  slots: [
    matSlot('frame', 'Frame & plates', 'metal-black-matte'),
    matSlot('bag', 'Bag', 'leather-black'),
    matSlot('gloves', 'Gloves', 'plastic-red'),
    matSlot('metal', 'Chains', 'metal-chrome'),
  ],
  build: ({ w, d, h }) => {
    const zp = -d / 2 + 0.08;
    const bz = Math.min(d / 2 - 0.22, zp + 0.6);
    const br = 0.17;
    const top = h - 0.42;
    const bot = Math.max(0.35, top - 1.05);
    const L = top - bot;
    const rx = w / 2 - 0.05;
    const swivel: V3 = [0, h - 0.2, bz];
    const parts: Part[] = [
      // Post, top arm and brace
      span('frame', [-0.04, 0.04], [0.05, h], [zp - 0.04, zp + 0.04]),
      span('frame', [-0.035, 0.035], [h - 0.07, h], [zp - 0.04, bz + 0.05], { plan: false }),
      rod('frame', [0, h - 0.45, zp + 0.035], [0, h - 0.07, zp + 0.35], 0.018, { plan: false }),
      // H-shaped base
      span('frame', [-rx, rx], [0, 0.05], [zp - 0.03, zp + 0.03]),
      span('frame', [-rx, rx], [0, 0.05], [d / 2 - 0.07, d / 2 - 0.01]),
      // Bag with bands, top cap and chains to a swivel
      lathe('bag', [0, bot, bz], [
        [0, 0],
        [br * 0.8, 0],
        [br, 0.05],
        [br, L - 0.05],
        [br * 0.85, L],
        [0, L],
      ], { segments: 24 }),
      ring('frame', [0, bot + L * 0.2, bz], br + 0.002, 0.007, { plan: false }),
      ring('frame', [0, bot + L * 0.8, bz], br + 0.002, 0.007, { plan: false }),
      vcyl('frame', 0, bz, top - 0.005, top + 0.02, br * 0.55, { plan: false }),
      rod('metal', swivel, [0, h - 0.07, bz], 0.012, { plan: false }),
    ];
    for (const a of cells(4, 0, Math.PI * 2)) {
      parts.push(rod('metal', [Math.cos(a) * br * 0.75, top + 0.02, bz + Math.sin(a) * br * 0.75], swivel, 0.005, { plan: false }));
    }
    for (const s of [-1, 1]) {
      parts.push(
        span('frame', [s * rx - 0.03, s * rx + 0.03], [0, 0.05], [-d / 2 + 0.01, d / 2 - 0.01]),
        rod('frame', [0, 0.6, zp + 0.03], [s * (rx - 0.05), 0.05, zp + 0.03], 0.016, { plan: false }),
        // Weight plates stacked on the base
        vcyl('frame', s * (rx - 0.2), -d / 2 + 0.22, 0.05, 0.09, 0.15, { plan: false }),
        vcyl('frame', s * (rx - 0.2), -d / 2 + 0.22, 0.09, 0.12, 0.11, { plan: false }),
        // Boxing gloves hung on the post
        sphere('gloves', [s * 0.075, 1.25, zp + 0.11], 0.5, { scale: [0.1, 0.16, 0.12], plan: false }),
        vcyl('gloves', s * 0.075, zp + 0.11, 1.32, 1.4, 0.04, { plan: false }),
      );
    }
    parts.push(rodX('metal', -0.1, 0.1, 1.42, zp + 0.06, 0.006, { plan: false }));
    return parts;
  },
  planDetail: ({ d }) => [circle([0, Math.min(d / 2 - 0.22, -d / 2 + 0.68)], 0.17)],
});

// ---------------------------------------------------------------------------
// Games
// ---------------------------------------------------------------------------

function poolPockets({ w, d }: Size3): V2[] {
  const ax = w / 2 - 0.12;
  const az = d / 2 - 0.12;
  return [
    [-ax, -az],
    [ax, -az],
    [-ax, az],
    [ax, az],
    [0, -az - 0.01],
    [0, az + 0.01],
  ];
}

const poolTable = defineAsset({
  id: 'pool-table',
  name: 'Pool table',
  category: 'hobbies',
  type: 'activities',
  group: 'Games',
  tags: ['pool', 'billiards', 'snooker', 'game room', 'games', 'table'],
  defaultSize: { w: 2.24, d: 1.27, h: 0.8 },
  minSize: { w: 1.9, d: 1.05, h: 0.76 },
  maxSize: { w: 2.85, d: 1.6, h: 0.84 },
  slots: [
    matSlot('cloth', 'Cloth', 'fabric-velvet-green'),
    matSlot('frame', 'Frame, legs & cue', 'wood-walnut'),
    matSlot('pockets', 'Pockets & black ball', 'leather-black'),
    matSlot('balls', 'Balls & sights', 'plastic-red'),
  ],
  build: (size) => {
    const { w, d, h } = size;
    const rw = 0.12;
    const ax = w / 2 - rw;
    const az = d / 2 - rw;
    const bed = h - 0.045;
    const parts: Part[] = [
      span('frame', [-w / 2 + 0.05, w / 2 - 0.05], [h - 0.25, h - 0.06], [-d / 2 + 0.05, d / 2 - 0.05], { bevel: 0.02 }),
      span('cloth', [-ax, ax], [h - 0.08, bed], [-az, az], { plan: false }),
      // Rails
      span('frame', [-w / 2, w / 2], [h - 0.06, h], [az, d / 2], { bevel: 0.012 }),
      span('frame', [-w / 2, w / 2], [h - 0.06, h], [-d / 2, -az], { bevel: 0.012 }),
      span('frame', [-w / 2, -ax], [h - 0.06, h], [-az, az], { bevel: 0.012 }),
      span('frame', [ax, w / 2], [h - 0.06, h], [-az, az], { bevel: 0.012 }),
      // Cushions, split by the pockets
      span('cloth', [ax - 0.04, ax], [bed, h - 0.008], [-az + 0.07, az - 0.07], { bevel: 0.01, plan: false }),
      span('cloth', [-ax, -ax + 0.04], [bed, h - 0.008], [-az + 0.07, az - 0.07], { bevel: 0.01, plan: false }),
    ];
    for (const sz of [-1, 1]) {
      const z: V2 = sz < 0 ? [-az, -az + 0.04] : [az - 0.04, az];
      parts.push(
        span('cloth', [-ax + 0.07, -0.06], [bed, h - 0.008], z, { bevel: 0.01, plan: false }),
        span('cloth', [0.06, ax - 0.07], [bed, h - 0.008], z, { bevel: 0.01, plan: false }),
      );
      // Diamond sights along the long rails
      for (const x of [...cells(3, -ax, 0), ...cells(3, 0, ax)]) {
        parts.push(vcyl('balls', x, sz * (d / 2 - rw / 2), h - 0.004, h + 0.001, 0.008, { plan: false }));
      }
    }
    for (const sx of [-1, 1]) {
      for (const z of cells(3, -az, az)) {
        parts.push(vcyl('balls', sx * (w / 2 - rw / 2), z, h - 0.004, h + 0.001, 0.008, { plan: false }));
      }
    }
    // Pockets with netted cups below
    for (const [x, z] of poolPockets(size)) {
      parts.push(vcyl('pockets', x, z, h - 0.07, h + 0.002, 0.058, { plan: false }));
      if (x !== 0) parts.push(vcyl('pockets', x * 1.02, z * 1.02, h - 0.2, h - 0.07, 0.07, { rTop: 0.075, plan: false }));
    }
    // Legs: three a side on long tables
    const nLegs = w > 2.4 ? 3 : 2;
    for (const x of spaced(nLegs, -w / 2 + 0.2, w / 2 - 0.2)) {
      for (const z of [-d / 2 + 0.17, d / 2 - 0.17]) {
        parts.push(turnedLeg('frame', x, z, 0, h - 0.25, 0.08, { style: 'spindle' }));
      }
    }
    // Racked balls at the foot spot (the black in the middle) and a cue on the cloth
    const r = 0.0285;
    const fx = ax / 2;
    for (let row = 0; row < 5; row++) {
      for (let j = 0; j <= row; j++) {
        const slot = row === 2 && j === 1 ? 'pockets' : 'balls';
        parts.push(sphere(slot, [fx + row * 2 * r * 0.87, bed + r, (j - row / 2) * 2 * r], r, { plan: false }));
      }
    }
    parts.push(rod('frame', [-ax * 0.75, bed + 0.012, -az * 0.45], [ax * 0.45, bed + 0.012, az * 0.05], 0.011, { rTop: 0.007, plan: false }));
    return parts;
  },
  planDetail: (size) => {
    const ax = size.w / 2 - 0.12;
    const az = size.d / 2 - 0.12;
    return [rectPoly(-ax, -az, ax, az), line([-ax / 2, -az], [-ax / 2, az]), ...poolPockets(size).map((p) => circle(p, 0.058))];
  },
});

function chessGeom({ w, d, h }: Size3) {
  const topY = Math.min(0.72, h - 0.1);
  const sq = Math.min((Math.min(w, d) - 0.12) / 8, 0.065, (h - topY - 0.008) / 1.5);
  return { topY, sq, bs: sq * 8 };
}

type PieceKind = 'P' | 'R' | 'N' | 'B' | 'Q' | 'K';

function chessPiece(slot: string, kind: PieceKind, x: number, y: number, z: number, s: number, facing: number): Part[] {
  const P: Record<PieceKind, V2[]> = {
    P: [[0, 0], [0.34, 0], [0.34, 0.08], [0.2, 0.14], [0.13, 0.42], [0.2, 0.47], [0.11, 0.52], [0.17, 0.6], [0.16, 0.7], [0.08, 0.78], [0, 0.8]],
    R: [[0, 0], [0.38, 0], [0.38, 0.1], [0.25, 0.18], [0.21, 0.68], [0.29, 0.73], [0.29, 0.92], [0, 0.92]],
    N: [[0, 0], [0.38, 0], [0.38, 0.1], [0.25, 0.18], [0.22, 0.4], [0, 0.4]],
    B: [[0, 0], [0.36, 0], [0.36, 0.1], [0.22, 0.18], [0.13, 0.64], [0.23, 0.69], [0.13, 0.74], [0.19, 0.92], [0.09, 1.08], [0.05, 1.12], [0, 1.15]],
    Q: [[0, 0], [0.38, 0], [0.38, 0.1], [0.24, 0.2], [0.14, 0.8], [0.27, 0.86], [0.16, 0.92], [0.26, 1.18], [0.1, 1.23], [0.06, 1.3], [0, 1.32]],
    K: [[0, 0], [0.4, 0], [0.4, 0.1], [0.25, 0.2], [0.15, 0.85], [0.28, 0.9], [0.17, 0.96], [0.24, 1.18], [0, 1.22]],
  };
  const parts: Part[] = [
    lathe(slot, [x, y, z], P[kind].map(([r, py]) => [r * s, py * s] as V2), { segments: 16, plan: false }),
  ];
  if (kind === 'K') {
    parts.push(
      box(slot, [x, y + 1.33 * s, z], [0.06 * s, 0.22 * s, 0.06 * s], { plan: false }),
      box(slot, [x, y + 1.35 * s, z], [0.18 * s, 0.06 * s, 0.06 * s], { plan: false }),
    );
  }
  if (kind === 'N') {
    parts.push(
      box(slot, [x, y + 0.66 * s, z - facing * 0.03 * s], [0.2 * s, 0.48 * s, 0.32 * s], {
        rotation: [facing * 0.3, 0, 0],
        bevel: 0.05 * s,
        plan: false,
      }),
      box(slot, [x, y + 0.78 * s, z + facing * 0.15 * s], [0.18 * s, 0.17 * s, 0.3 * s], { bevel: 0.05 * s, plan: false }),
    );
  }
  return parts;
}

const chessTable = defineAsset({
  id: 'chess-table',
  name: 'Chess table',
  category: 'hobbies',
  type: 'activities',
  group: 'Games',
  tags: ['chess', 'board game', 'game table', 'games', 'checkers'],
  defaultSize: { w: 0.6, d: 0.6, h: 0.82 },
  minSize: { w: 0.5, d: 0.5, h: 0.75 },
  maxSize: { w: 0.8, d: 0.8, h: 0.9 },
  slots: [
    matSlot('table', 'Table & dark squares', 'wood-walnut'),
    matSlot('board', 'Light squares', 'wood-ash-white'),
    matSlot('white', 'White pieces', 'ceramic-white'),
    matSlot('black', 'Black pieces', 'wood-ebony'),
  ],
  build: (size) => {
    const { w, d } = size;
    const { topY, sq, bs } = chessGeom(size);
    const parts: Part[] = [
      span('table', [-w / 2, w / 2], [topY - 0.035, topY], [-d / 2, d / 2], { bevel: 0.008 }),
      span('table', [-w / 2 + 0.04, w / 2 - 0.04], [topY - 0.11, topY - 0.035], [-d / 2 + 0.04, d / 2 - 0.04], { plan: false }),
      lathe('table', [0, 0.05, 0], [
        [0, 0],
        [0.07, 0],
        [0.08, 0.04],
        [0.045, 0.1],
        [0.04, topY - 0.32],
        [0.06, topY - 0.25],
        [0.045, topY - 0.2],
        [0.055, topY - 0.16],
        [0, topY - 0.16],
      ], { segments: 20, plan: false }),
      span('table', [-w / 2 + 0.06, w / 2 - 0.06], [0, 0.05], [-0.035, 0.035], { bevel: 0.01, plan: false }),
      span('table', [-0.035, 0.035], [0, 0.05], [-d / 2 + 0.06, d / 2 - 0.06], { bevel: 0.01, plan: false }),
      span('board', [-bs / 2, bs / 2], [topY, topY + 0.003], [-bs / 2, bs / 2], { plan: false }),
    ];
    const fx = (f: number) => -bs / 2 + (f + 0.5) * sq;
    const rz = (r: number) => bs / 2 - (r + 0.5) * sq;
    for (let f = 0; f < 8; f++) {
      for (let r = 0; r < 8; r++) {
        if ((f + r) % 2 !== 0) continue;
        parts.push(span('table', [fx(f) - sq / 2, fx(f) + sq / 2], [topY, topY + 0.004], [rz(r) - sq / 2, rz(r) + sq / 2], { plan: false }));
      }
    }
    // An opening in progress: 1. e4 e5 2. Nf3 Nc6
    const backRank: PieceKind[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    const y = topY + 0.004;
    const s = sq * 0.95;
    for (let f = 0; f < 8; f++) {
      const wFile = f === 6 ? -1 : f;
      if (wFile >= 0) parts.push(...chessPiece('white', backRank[f], fx(f), y, rz(0), s, -1));
      const bFile = f === 1 ? -1 : f;
      if (bFile >= 0) parts.push(...chessPiece('black', backRank[f], fx(f), y, rz(7), s, 1));
      parts.push(...chessPiece('white', 'P', fx(f), y, rz(f === 4 ? 3 : 1), s, -1));
      parts.push(...chessPiece('black', 'P', fx(f), y, rz(f === 4 ? 4 : 6), s, 1));
    }
    parts.push(...chessPiece('white', 'N', fx(5), y, rz(2), s, -1), ...chessPiece('black', 'N', fx(2), y, rz(5), s, 1));
    return parts;
  },
  planDetail: (size) => {
    const { sq, bs } = chessGeom(size);
    const out: PlanStroke[] = [rectPoly(-bs / 2, -bs / 2, bs / 2, bs / 2)];
    for (let i = 1; i < 8; i++) {
      const t = -bs / 2 + i * sq;
      out.push(line([t, -bs / 2], [t, bs / 2]), line([-bs / 2, t], [bs / 2, t]));
    }
    return out;
  },
});

const foosballTable = defineAsset({
  id: 'foosball-table',
  name: 'Foosball table',
  category: 'hobbies',
  type: 'activities',
  group: 'Games',
  tags: ['foosball', 'table football', 'table soccer', 'games', 'game room'],
  defaultSize: { w: 1.4, d: 1.2, h: 0.92 },
  minSize: { w: 1.2, d: 1.0, h: 0.85 },
  maxSize: { w: 1.6, d: 1.4, h: 0.98 },
  slots: [
    matSlot('cabinet', 'Cabinet, rods & handles', 'laminate-black'),
    matSlot('field', 'Playfield', 'fabric-velvet-green'),
    matSlot('red', 'Red team', 'plastic-red'),
    matSlot('blue', 'Blue team', 'plastic-blue'),
  ],
  build: ({ w, d, h }) => {
    const cd = Math.min(0.76, d - 0.36);
    const fy = h - 0.2;
    const t = 0.03;
    const ry = h - 0.08;
    const fl = w - 2 * t;
    const counts = [1, 2, 3, 5, 5, 3, 2, 1];
    const teams = ['red', 'red', 'blue', 'red', 'blue', 'red', 'blue', 'blue'];
    const parts: Part[] = [
      span('cabinet', [-w / 2, w / 2], [fy - 0.14, fy - 0.02], [-cd / 2, cd / 2], { bevel: 0.01 }),
      span('field', [-w / 2 + t, w / 2 - t], [fy - 0.02, fy], [-cd / 2 + t, cd / 2 - t], { plan: false }),
      span('cabinet', [-w / 2, w / 2], [fy - 0.02, h], [cd / 2 - t, cd / 2], { bevel: 0.006 }),
      span('cabinet', [-w / 2, w / 2], [fy - 0.02, h], [-cd / 2, -cd / 2 + t], { bevel: 0.006 }),
      span('cabinet', [-w / 2, -w / 2 + t], [fy - 0.02, h], [-cd / 2 + t, cd / 2 - t]),
      span('cabinet', [w / 2 - t, w / 2], [fy - 0.02, h], [-cd / 2 + t, cd / 2 - t]),
      // Goals in each team's colour
      span('red', [-w / 2 + t, -w / 2 + t + 0.006], [fy, fy + 0.09], [-0.1, 0.1], { plan: false }),
      span('blue', [w / 2 - t - 0.006, w / 2 - t], [fy, fy + 0.09], [-0.1, 0.1], { plan: false }),
    ];
    // Legs with side braces
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - 0.08);
        const z = sz * (cd / 2 - 0.06);
        parts.push(span('cabinet', [x - 0.04, x + 0.04], [0, fy - 0.14], [z - 0.04, z + 0.04], { bevel: 0.006, plan: false }));
      }
      parts.push(span('cabinet', [sx * (w / 2 - 0.08) - 0.02, sx * (w / 2 - 0.08) + 0.02], [0.14, 0.2], [-cd / 2 + 0.06, cd / 2 - 0.06], { plan: false }));
    }
    // Score beads above each goal
    for (const [i, x] of spaced(5, -0.08, 0.08).entries()) {
      parts.push(sphere(i < 2 ? 'red' : 'cabinet', [x, h + 0.005, -cd / 2 + t / 2], 0.012, { plan: false }));
    }
    // Rods, handles and players
    for (const [i, x] of cells(8, -fl / 2, fl / 2).entries()) {
      const team = teams[i];
      const side = team === 'red' ? 1 : -1;
      parts.push(
        rodZ('cabinet', x, ry, -side * (cd / 2 + 0.07), side * (d / 2 - 0.12), 0.008, { plan: false }),
        rodZ('cabinet', x, ry, side * (d / 2 - 0.13), side * (d / 2 - 0.005), 0.02, { plan: false }),
      );
      const n = counts[i];
      const spread = Math.min(cd - 0.16, n === 2 ? 0.26 : n === 3 ? 0.44 : 0.56);
      for (const z of spaced(n, -spread / 2, spread / 2)) {
        parts.push(
          span(team, [x - 0.013, x + 0.013], [fy + 0.015, ry + 0.025], [z - 0.022, z + 0.022], { bevel: 0.008, plan: false }),
          sphere(team, [x, ry + 0.042, z], 0.018, { plan: false }),
        );
      }
    }
    return parts;
  },
  planDetail: ({ w, d }) => {
    const cd = Math.min(0.76, d - 0.36);
    const fl = w - 0.06;
    return [line([0, -cd / 2 + 0.03], [0, cd / 2 - 0.03]), circle([0, 0], 0.08), ...cells(8, -fl / 2, fl / 2).map((x) => line([x, -d / 2 + 0.02], [x, d / 2 - 0.02]))];
  },
});

const arcadeCabinet = defineAsset({
  id: 'arcade-cabinet',
  name: 'Arcade cabinet',
  category: 'hobbies',
  type: 'activities',
  group: 'Games',
  tags: ['arcade', 'retro', 'video game', 'cabinet', 'games', 'game room'],
  defaultSize: { w: 0.7, d: 0.8, h: 1.8 },
  minSize: { w: 0.6, d: 0.7, h: 1.65 },
  maxSize: { w: 0.8, d: 0.95, h: 1.95 },
  slots: [
    matSlot('body', 'Cabinet', 'laminate-navy'),
    matSlot('trim', 'Bezel & trim', 'plastic-black'),
    matSlot('buttons', 'Buttons & joystick', 'plastic-red'),
    matSlot('screen', 'Screen & marquee', 'screen-glow'),
  ],
  build: ({ w, d, h }) => {
    const k = h / 1.8;
    const zf = d / 2;
    const zb = -d / 2;
    const prof: V2[] = [
      [0, zb],
      [0, zf - 0.06],
      [0.82 * k, zf - 0.06],
      [0.9 * k, zf],
      [0.97 * k, zf],
      [1.0 * k, zf - 0.22],
      [1.48 * k, zf - 0.38],
      [1.5 * k, zf - 0.3],
      [h, zf - 0.28],
      [h, zb],
    ];
    const iw: V2 = [-w / 2 + 0.02, w / 2 - 0.02];
    // Screen plane from the control panel up to the marquee
    const s0: V2 = [1.0 * k, zf - 0.22];
    const s1: V2 = [1.48 * k, zf - 0.38];
    const sa = Math.atan2(s0[1] - s1[1], s1[0] - s0[0]);
    const slen = Math.hypot(s1[0] - s0[0], s1[1] - s0[1]);
    const sn: V3 = [0, Math.sin(sa), Math.cos(sa)];
    const sc: V3 = [0, (s0[0] + s1[0]) / 2, (s0[1] + s1[1]) / 2];
    const cy = 0.97 * k;
    const parts: Part[] = [
      sideProfile('body', prof, -w / 2, 0.02),
      sideProfile('body', prof, w / 2 - 0.02, 0.02),
      span('body', iw, [0, h - 0.01], [zb, zf - 0.38], { plan: false }),
      span('body', iw, [0.04, 0.82 * k], [zb, zf - 0.07], { plan: false }),
      span('trim', iw, [0, 0.06], [zf - 0.08, zf - 0.06], { plan: false }),
      // Coin door with two lit coin slots
      span('trim', [-0.12, 0.12], [0.35 * k, 0.6 * k], [zf - 0.07, zf - 0.055], { bevel: 0.004, plan: false }),
      span('buttons', [-0.07, -0.03], [0.5 * k, 0.53 * k], [zf - 0.055, zf - 0.05], { plan: false }),
      span('buttons', [0.03, 0.07], [0.5 * k, 0.53 * k], [zf - 0.055, zf - 0.05], { plan: false }),
      // Control deck, joystick and buttons
      span('body', iw, [0.84 * k, cy], [zf - 0.24, zf - 0.005], { bevel: 0.01, plan: false }),
      vcyl('trim', -0.14, zf - 0.11, cy, cy + 0.004, 0.035, { plan: false }),
      rod('trim', [-0.14, cy, zf - 0.11], [-0.14, cy + 0.07, zf - 0.11], 0.006, { plan: false }),
      sphere('buttons', [-0.14, cy + 0.08, zf - 0.11], 0.018, { plan: false }),
      // Bezel, screen and marquee
      box('trim', add(sc, sn, -0.01), [w - 0.05, slen, 0.02], { rotation: [-sa, 0, 0], plan: false }),
      box('screen', add(sc, sn, 0.001), [w - 0.16, slen * 0.78, 0.006], { rotation: [-sa, 0, 0], plan: false }),
      span('screen', iw, [1.5 * k + 0.01, h - 0.03], [zf - 0.3, zf - 0.29], { plan: false }),
      span('trim', iw, [h - 0.03, h - 0.01], [zf - 0.3, zf - 0.28], { plan: false }),
      span('trim', iw, [1.5 * k - 0.01, 1.5 * k + 0.01], [zf - 0.31, zf - 0.28], { plan: false }),
    ];
    for (const [j, z] of [zf - 0.08, zf - 0.14].entries()) {
      for (const x of spaced(3, -0.03, 0.09)) {
        parts.push(vcyl(j === 0 ? 'buttons' : 'trim', x + j * 0.02, z, cy, cy + 0.012, 0.014, { plan: false }));
      }
    }
    for (const x of [-0.04, 0.04]) parts.push(vcyl('buttons', x, zf - 0.2, cy, cy + 0.008, 0.009, { plan: false }));
    return parts;
  },
  planDetail: ({ w, d }) => [line([-w / 2 + 0.02, d / 2 - 0.24], [w / 2 - 0.02, d / 2 - 0.24]), line([-w / 2 + 0.02, d / 2 - 0.38], [w / 2 - 0.02, d / 2 - 0.38])],
});

const dartboard = defineAsset({
  id: 'dartboard',
  name: 'Dartboard',
  category: 'hobbies',
  type: 'activities',
  group: 'Games',
  tags: ['darts', 'dartboard', 'pub game', 'games', 'wall'],
  defaultSize: { w: 0.5, d: 0.12, h: 0.5 },
  minSize: { w: 0.4, d: 0.08, h: 0.4 },
  maxSize: { w: 0.6, d: 0.16, h: 0.6 },
  mount: 'wall',
  defaultElevation: 1.48,
  slots: [
    matSlot('dark', 'Black segments & ring', 'solid-black'),
    matSlot('board', 'Sisal segments', 'fabric-cream'),
    matSlot('red', 'Red rings & flights', 'solid-red'),
    matSlot('green', 'Green rings', 'solid-green'),
  ],
  build: ({ w, d, h }) => {
    const R = Math.min(w, h) / 2 - 0.005;
    const cy = h / 2;
    const zb = -d / 2;
    const zf = zb + Math.min(0.04, d * 0.45);
    const rDo = R * 0.755;
    const rDi = R * 0.72;
    const rTo = R * 0.475;
    const rTi = R * 0.44;
    const rB = R * 0.07;
    const seg = (Math.PI * 2) / 20;
    const sector = (r0: number, r1: number, a0: number, a1: number): V2[] =>
      [...arcPoints(0, cy, r1, a0, a1, 3), ...arcPoints(0, cy, r0, a1, a0, 3)].map(([x, y]) => [x, y] as V2);
    const parts: Part[] = [
      discZ('dark', [0, cy, (zb + zf) / 2], R, zf - zb),
      discZ('board', [0, cy, zf + 0.001], rDo, 0.002, { plan: false }),
      discZ('green', [0, cy, zf + 0.007], rB, 0.002, { plan: false }),
      discZ('red', [0, cy, zf + 0.009], rB * 0.4, 0.002, { plan: false }),
    ];
    for (let i = 0; i < 20; i++) {
      const a0 = Math.PI / 2 + (i - 0.5) * seg;
      const a1 = a0 + seg;
      const dark = i % 2 === 0;
      if (dark) parts.push(facePrism('dark', sector(rB, rDo, a0, a1), zf + 0.002, 0.002, { plan: false }));
      const ring = dark ? 'red' : 'green';
      parts.push(
        facePrism(ring, sector(rDi, rDo, a0, a1), zf + 0.004, 0.002, { plan: false }),
        facePrism(ring, sector(rTi, rTo, a0, a1), zf + 0.004, 0.002, { plan: false }),
      );
      // Number plates around the outer ring
      const am = a0 + seg / 2;
      parts.push(box('board', [Math.cos(am) * R * 0.88, cy + Math.sin(am) * R * 0.88, zf + 0.0015], [R * 0.06, R * 0.075, 0.003], { plan: false }));
    }
    // Three darts in the board
    const dl = clamp(d / 2 - zf - 0.012, 0.03, 0.08);
    const darts: [number, number, number][] = [
      [0.02, R * 0.46, 0.08],
      [-R * 0.2, R * 0.3, -0.12],
      [R * 0.3, -R * 0.1, 0.05],
    ];
    for (const [x, y, lean] of darts) {
      const tip: V3 = [x, cy + y, zf + 0.004];
      const end: V3 = [x + lean * dl, cy + y + 0.15 * dl, zf + 0.004 + dl * 0.98];
      parts.push(
        rod('dark', tip, end, 0.004, { plan: false }),
        box('red', end, [0.028, 0.002, 0.022], { plan: false }),
        box('red', end, [0.002, 0.028, 0.022], { plan: false }),
      );
    }
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Creative
// ---------------------------------------------------------------------------

const easelPainting = defineAsset({
  id: 'easel-painting',
  name: 'Painting easel',
  category: 'hobbies',
  type: 'activities',
  group: 'Creative',
  tags: ['easel', 'painting', 'art', 'canvas', 'artist', 'studio'],
  defaultSize: { w: 0.7, d: 0.7, h: 1.8 },
  minSize: { w: 0.55, d: 0.55, h: 1.5 },
  maxSize: { w: 0.9, d: 0.9, h: 2.2 },
  slots: [
    matSlot('wood', 'Easel', 'wood-pine'),
    matSlot('canvas', 'Canvas', 'paper-art'),
    matSlot('paint', 'Paint', 'plastic-red'),
    matSlot('metal', 'Brass fittings & jar', 'metal-brass'),
  ],
  build: ({ w, d, h }) => {
    const t = 0.13;
    const zF = d / 2 - 0.1;
    const mastAt = (y: number) => zF - 0.05 - y * Math.tan(t);
    const fx = w / 2 - 0.04;
    const top = h - 0.02;
    const legX = (y: number) => fx + (0.04 - fx) * (y / top);
    const ly = clamp(h * 0.42, 0.6, 0.85);
    const tw = Math.min(0.6, w - 0.1);
    const mz = mastAt(ly);
    const ch = clamp(h - ly - 0.18, 0.3, 0.75);
    const cw = Math.min(0.62, w - 0.08);
    const cyc = ly + ch / 2 + 0.002;
    const rot: V3 = [-t, 0, 0];
    const parts: Part[] = [
      // Front legs, mast and back leg
      rod('wood', [-fx, 0, zF], [-0.04, top, mastAt(top)], 0.016, { segments: 8 }),
      rod('wood', [fx, 0, zF], [0.04, top, mastAt(top)], 0.016, { segments: 8 }),
      rod('wood', [0, 0.25, mastAt(0.25)], [0, h - 0.01, mastAt(h - 0.01)], 0.02, { segments: 8, plan: false }),
      rod('wood', [0, h * 0.72, mastAt(h * 0.72) - 0.02], [0, 0.005, -d / 2 + 0.03], 0.016, { segments: 8 }),
      rodX('wood', -legX(0.3), legX(0.3), 0.3, zF - 0.3 * Math.tan(t) * 0.3, 0.012, { plan: false }),
      sphere('metal', [0, h * 0.72, mastAt(h * 0.72) - 0.005], 0.018, { plan: false }),
      // Canvas tray with lip
      span('wood', [-tw / 2, tw / 2], [ly - 0.02, ly], [mz - 0.01, mz + 0.08], { plan: false }),
      span('wood', [-tw / 2, tw / 2], [ly, ly + 0.025], [mz + 0.07, mz + 0.08], { plan: false }),
      // Canvas and top clamp
      box('canvas', [0, cyc, mastAt(cyc) + 0.035], [cw, ch, 0.02], { rotation: rot, plan: false }),
      box('wood', [0, cyc + ch / 2 + 0.03, mastAt(cyc + ch / 2 + 0.03) + 0.03], [0.1, 0.04, 0.05], { rotation: rot, plan: false }),
      // Brush jar on the tray
      vcyl('metal', tw / 2 - 0.06, mz + 0.035, ly, ly + 0.08, 0.028, { plan: false }),
    ];
    for (const [i, a] of [-0.25, 0.05, 0.3].entries()) {
      const b: V3 = [tw / 2 - 0.06, ly + 0.04, mz + 0.035];
      const e: V3 = [b[0] + Math.sin(a) * 0.1, ly + 0.17 + i * 0.01, b[2] + 0.02];
      parts.push(rod('wood', b, e, 0.004, { plan: false }), sphere('paint', e, 0.007, { scale: [1, 1.6, 1], plan: false }));
    }
    // Paint dabs on the tray
    for (const x of [-0.15, -0.11, -0.07]) parts.push(sphere('paint', [x, ly + 0.005, mz + 0.035], 0.012, { scale: [1, 0.4, 1], plan: false }));
    return parts;
  },
});

const sewingTable = defineAsset({
  id: 'sewing-table',
  name: 'Sewing machine table',
  category: 'hobbies',
  type: 'activities',
  group: 'Creative',
  tags: ['sewing', 'sewing machine', 'treadle', 'crafts', 'vintage', 'table'],
  defaultSize: { w: 1.1, d: 0.55, h: 1.05 },
  minSize: { w: 0.9, d: 0.45, h: 0.95 },
  maxSize: { w: 1.5, d: 0.7, h: 1.15 },
  slots: [
    matSlot('table', 'Table top & drawers', 'wood-walnut'),
    matSlot('iron', 'Cast iron & machine', 'metal-black-matte'),
    matSlot('metal', 'Chrome parts', 'metal-chrome'),
    matSlot('fabric', 'Fabric & thread', 'fabric-terracotta'),
  ],
  build: ({ w, d, h }) => {
    const ty = clamp(h - 0.3, 0.66, 0.76);
    const k = (h - ty) / 0.3;
    const sx = w / 2 - 0.06;
    const toX: V3 = [0, 0, Math.PI / 2];
    const toYZ: V3 = [0, Math.PI / 2, 0];
    const drawers: FrontSpec[] = cellSpans(2, ty - 0.17, ty - 0.03).map(([y0, y1]) => ({
      x: [-w / 2 + 0.05, -w / 2 + 0.31] as V2,
      y: [y0, y1] as V2,
      handle: { kind: 'knob' as const },
    }));
    const wx = w / 2 - 0.12;
    const parts: Part[] = [
      span('table', [-w / 2, w / 2], [ty - 0.03, ty], [-d / 2, d / 2], { bevel: 0.008 }),
      span('table', [-w / 2 + 0.04, -w / 2 + 0.32], [ty - 0.17, ty - 0.03], [-d / 2 + 0.04, d / 2 - 0.02], { plan: false }),
      ...fronts('table', 'metal', drawers, d / 2 - 0.02, 0.015, 0.012),
      // Treadle plate and pivot
      box('iron', [0, 0.12, 0.05], [w - 0.24, 0.025, 0.28], { rotation: [0.15, 0, 0], plan: false }),
      rodX('iron', -sx, sx, 0.12, 0.05, 0.01, { plan: false }),
      // Belt wheel with spokes, and the leather belt up to the machine
      torus('iron', [wx, 0.42, 0], 0.17, 0.014, { rotation: toYZ, plan: false }),
      cyl('iron', [wx, 0.42, 0], 0.03, 0.05, { rotation: toX, plan: false }),
      rod('iron', [wx, 0.42, 0], [wx, 0.12, 0.08], 0.008, { plan: false }),
      rod('table', [wx, 0.59, 0], [wx, ty, 0], 0.003, { plan: false }),
      // Scroll on the left frame
      torus('iron', [-sx, 0.42, 0], 0.12, 0.012, { rotation: toYZ, plan: false }),
    ];
    for (const a of [0, Math.PI / 2]) {
      parts.push(rod('iron', [wx, 0.42 - Math.cos(a) * 0.16, -Math.sin(a) * 0.16], [wx, 0.42 + Math.cos(a) * 0.16, Math.sin(a) * 0.16], 0.006, { plan: false }));
    }
    for (const s of [-1, 1]) {
      const x = s * sx;
      parts.push(
        rod('iron', [x, 0.05, -d / 2 + 0.08], [x, ty - 0.03, -d / 2 + 0.12], 0.018, { plan: false }),
        rod('iron', [x, 0.05, d / 2 - 0.08], [x, ty - 0.03, d / 2 - 0.12], 0.018, { plan: false }),
        span('iron', [x - 0.03, x + 0.03], [0, 0.05], [-d / 2 + 0.02, d / 2 - 0.02], { bevel: 0.01, plan: false }),
        rodZ('iron', x, ty - 0.07, -d / 2 + 0.12, d / 2 - 0.12, 0.015, { plan: false }),
        rodZ('iron', x, 0.25, -d / 2 + 0.1, d / 2 - 0.1, 0.012, { plan: false }),
      );
    }
    // Vintage machine: bed, pillar, arm, head, handwheel, needle and presser foot
    parts.push(
      span('iron', [-0.22, 0.2], [ty, ty + 0.05 * k], [-0.09, 0.09], { bevel: 0.008, plan: false }),
      span('iron', [0.08, 0.17], [ty + 0.05 * k, h - 0.08 * k], [-0.07, 0.03], { bevel: 0.02, plan: false }),
      span('iron', [-0.17, 0.17], [h - 0.15 * k, h - 0.06 * k], [-0.06, 0.02], { bevel: 0.03, plan: false }),
      span('iron', [-0.22, -0.13], [h - 0.19 * k, h - 0.05 * k], [-0.065, 0.035], { bevel: 0.025, plan: false }),
      cyl('metal', [0.185, h - 0.1 * k, -0.02], 0.055 * k, 0.03, { rotation: toX, plan: false }),
      rod('metal', [-0.18, h - 0.19 * k, 0.005], [-0.18, ty + 0.065 * k, 0.005], 0.004, { plan: false }),
      span('metal', [-0.2, -0.16], [ty + 0.05 * k, ty + 0.06 * k], [-0.01, 0.025], { plan: false }),
      // Thread spool on the arm
      vcyl('fabric', 0.02, -0.02, h - 0.06 * k, h - 0.01, 0.017, { plan: false }),
      // Fabric under the needle, falling over the front edge
      span('fabric', [-0.36, -0.04], [ty, ty + 0.004], [-0.02, d / 2], { plan: false }),
      span('fabric', [-0.34, -0.06], [ty - 0.12, ty + 0.002], [d / 2, d / 2 + 0.004], { plan: false }),
      // Pincushion and spare spools
      sphere('fabric', [w / 2 - 0.12, ty + 0.025, 0.12], 0.035, { scale: [1, 0.7, 1], plan: false }),
      vcyl('fabric', w / 2 - 0.1, -d / 2 + 0.1, ty, ty + 0.05, 0.018, { plan: false }),
      vcyl('fabric', w / 2 - 0.15, -d / 2 + 0.09, ty, ty + 0.05, 0.018, { plan: false }),
    );
    return parts;
  },
});

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

function scopeGeom({ d, h }: Size3) {
  const yM = Math.min(1.05, h - 0.35);
  const e = 0.55;
  const L = Math.min(0.95, (d / 2 - 0.08) / (0.65 * Math.cos(e)), (h - yM - 0.16) / (0.65 * Math.sin(e)));
  return { yM, e, L };
}

const telescope = defineAsset({
  id: 'telescope',
  name: 'Telescope',
  category: 'hobbies',
  type: 'activities',
  group: 'Knowledge',
  tags: ['telescope', 'astronomy', 'stargazing', 'science', 'tripod'],
  defaultSize: { w: 0.7, d: 0.9, h: 1.5 },
  minSize: { w: 0.6, d: 0.7, h: 1.3 },
  maxSize: { w: 0.9, d: 1.2, h: 1.8 },
  slots: [
    matSlot('tube', 'Tube', 'plastic-white'),
    matSlot('metal', 'Mount & fittings', 'metal-black-matte'),
    matSlot('legs', 'Tripod', 'metal-brushed-steel'),
    matSlot('glass', 'Lens', 'glass-tinted'),
  ],
  build: (size) => {
    const { w, d } = size;
    const { yM, e, L } = scopeGeom(size);
    const u: V3 = [0, Math.sin(e), -Math.cos(e)];
    const n: V3 = [0, Math.cos(e), Math.sin(e)];
    const ax: V3 = [0, yM + 0.09, 0];
    const P = (s: number, off: V3 = [0, 0, 0]): V3 => add(add(ax, u, s), off);
    const fOff = add([0.05, 0, 0], n, 0.05);
    const eye = P(-0.35 * L - 0.09);
    const R = Math.min(w, d) / 2 - 0.03;
    const parts: Part[] = [
      // Tube, dew shield, objective lens and rings
      rod('tube', P(-0.35 * L), P(0.55 * L), 0.055),
      rod('tube', P(0.55 * L), P(0.65 * L), 0.065, { plan: false }),
      rod('glass', P(0.646 * L), P(0.652 * L), 0.058, { plan: false }),
      rod('metal', P(-0.03), P(0.03), 0.064, { plan: false }),
      rod('metal', P(0.2 * L - 0.03), P(0.2 * L + 0.03), 0.064, { plan: false }),
      // Focuser, star diagonal and eyepiece
      rod('metal', P(-0.35 * L - 0.08), P(-0.35 * L), 0.028, { plan: false }),
      rod('metal', eye, add(eye, [0, 1, 0], 0.06), 0.02, { plan: false }),
      rod('metal', add(eye, [0, 1, 0], 0.06), add(eye, [0, 1, 0], 0.1), 0.016, { plan: false }),
      // Finder scope on two brackets
      rod('tube', P(-0.15 * L, fOff), P(0.1 * L, fOff), 0.018, { plan: false }),
      rod('metal', P(-0.1 * L), P(-0.1 * L, fOff), 0.006, { plan: false }),
      rod('metal', P(0.05 * L), P(0.05 * L, fOff), 0.006, { plan: false }),
      // Alt-az head and fork arm
      box('metal', [0, yM, 0], [0.09, 0.1, 0.09], { bevel: 0.01, plan: false }),
      span('metal', [0.055, 0.075], [yM, yM + 0.1], [-0.03, 0.03], { plan: false }),
      rod('metal', [0.04, yM, 0.03], [0.04, yM - 0.18, 0.14], 0.004, { plan: false }),
      vcyl('metal', 0, 0, yM - 0.12, yM - 0.05, 0.06, { plan: false }),
    ];
    // Tripod with extension legs and an accessory tray
    const legTop = yM - 0.1;
    const trayY = 0.45;
    const f = (legTop - trayY) / (legTop - 0.01);
    const tr = (0.05 + (R - 0.05) * f) * 0.95;
    const tray: V2[] = [];
    for (let i = 0; i < 3; i++) {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const mid: V3 = [c * (0.05 + (R - 0.05) * 0.55), legTop - (legTop - 0.01) * 0.55, s * (0.05 + (R - 0.05) * 0.55)];
      parts.push(
        rod('legs', [c * 0.05, legTop, s * 0.05], mid, 0.016, { plan: false }),
        rod('legs', mid, [c * R, 0.01, s * R], 0.011, { plan: false }),
        sphere('metal', [c * R, 0.015, s * R], 0.015, { plan: false }),
      );
      tray.push([c * tr, s * tr]);
    }
    parts.push(prism('legs', tray, trayY, 0.012, { plan: false }));
    for (const [x, z] of [
      [-0.04, 0.0],
      [0.03, -0.03],
      [0.0, 0.05],
    ] as V2[]) {
      parts.push(vcyl('metal', x, z, trayY + 0.012, trayY + 0.05, 0.014, { plan: false }));
    }
    return parts;
  },
  planDetail: (size) => {
    const R = Math.min(size.w, size.d) / 2 - 0.03;
    return [0, 1, 2].map((i) => {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
      return line([0, 0], [Math.cos(a) * R, Math.sin(a) * R]);
    });
  },
});

const aquarium = defineAsset({
  id: 'aquarium',
  name: 'Aquarium on stand',
  category: 'pets',
  type: 'pets',
  group: 'Pet birds & animals',
  tags: ['aquarium', 'fish tank', 'fish', 'pets', 'water', 'nature'],
  defaultSize: { w: 1.0, d: 0.4, h: 1.35 },
  minSize: { w: 0.6, d: 0.3, h: 1.1 },
  maxSize: { w: 1.8, d: 0.6, h: 1.6 },
  wallSnap: true,
  slots: [
    matSlot('stand', 'Stand & frame', 'wood-walnut'),
    matSlot('water', 'Water', 'water'),
    matSlot('plants', 'Water plants', 'plant-leaf'),
    matSlot('accents', 'Gravel, rocks & fish', 'terracotta-pot'),
  ],
  build: ({ w, d, h }) => {
    const sy = clamp(h * 0.52, 0.55, 0.78);
    const tTop = h - 0.06;
    const tx = w / 2 - 0.01;
    const tz = d / 2 - 0.01;
    const wy0 = sy + 0.025;
    const wy1 = tTop - 0.03;
    const nDoors = w > 1.1 ? 3 : 2;
    const doors: FrontSpec[] = cellSpans(nDoors, -w / 2 + 0.02, w / 2 - 0.02).map(([x0, x1]) => ({
      x: [x0, x1] as V2,
      y: [0.1, sy - 0.04] as V2,
      handle: { kind: 'knob' as const, y: sy - 0.1 },
    }));
    const parts: Part[] = [
      // Cabinet stand with doors
      span('stand', [-w / 2, w / 2], [0.08, sy - 0.03], [-d / 2, d / 2 - 0.02]),
      span('stand', [-w / 2 + 0.02, w / 2 - 0.02], [0, 0.08], [-d / 2 + 0.02, d / 2 - 0.04], { plan: false }),
      span('stand', [-w / 2, w / 2], [sy - 0.03, sy], [-d / 2, d / 2], { bevel: 0.006 }),
      ...fronts('stand', 'stand', doors, d / 2 - 0.02, 0.016, 0.018),
      // Tank: bottom rim, corner posts and hood
      span('stand', [-tx, tx], [sy, wy0], [-tz, tz], { plan: false }),
      span('stand', [-w / 2, w / 2], [tTop, h], [-d / 2, d / 2], { bevel: 0.01, plan: false }),
      span('water', [-tx + 0.008, tx - 0.008], [wy0, wy1], [-tz + 0.008, tz - 0.008], { plan: false }),
      // Gravel bed and rocks
      span('accents', [-tx + 0.01, tx - 0.01], [wy0, wy0 + 0.03], [-tz + 0.01, tz - 0.01], { plan: false }),
      ...blobCluster('accents', [-tx * 0.35, wy0 + 0.06, -tz * 0.3], Math.min(0.08, tz - 0.02), 4, 11),
    ];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        parts.push(span('stand', [sx * tx - 0.008, sx * tx + 0.008], [wy0, tTop], [sz * tz - 0.008, sz * tz + 0.008], { plan: false }));
      }
    }
    // Water plants
    const ph = wy1 - wy0 - 0.08;
    const pr = Math.min(0.09, tz - 0.03);
    for (const [i, x] of [-tx * 0.7, tx * 0.15, tx * 0.65].entries()) {
      parts.push(...foliage('plants', [x, wy0 + 0.02, -tz * 0.35], pr, ph * (i === 1 ? 0.6 : 1), 7, 31 + i, { leafWid: 0.025, spread: 0.3 }));
    }
    // Goldfish
    const rand = rng(5);
    for (let i = 0; i < 5; i++) {
      const dir = rand() < 0.5 ? -1 : 1;
      const x = (rand() * 2 - 1) * (tx - 0.1);
      const y = wy0 + 0.1 + rand() * Math.max(0.01, wy1 - wy0 - 0.18);
      const z = (rand() * 2 - 1) * (tz - 0.05);
      parts.push(
        sphere('accents', [x, y, z], 0.5, { scale: [0.06, 0.03, 0.016], plan: false }),
        box('accents', [x - dir * 0.035, y, z], [0.018, 0.018, 0.003], { rotation: [0, 0, Math.PI / 4], plan: false }),
      );
    }
    return parts;
  },
  planDetail: ({ w, d }) => [rectPoly(-w / 2 + 0.02, -d / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.02)],
});

export const HOBBIES_ASSETS: AssetDefinition[] = [
  pianoUpright,
  pianoGrand,
  guitarStand,
  drumKit,
  keyboardStand,
  treadmill,
  exerciseBike,
  weightBench,
  yogaMat,
  punchingBag,
  poolTable,
  chessTable,
  foosballTable,
  arcadeCabinet,
  easelPainting,
  telescope,
  sewingTable,
  aquarium,
  dartboard,
];

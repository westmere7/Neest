import type { ReactNode } from 'react';
import type { OpeningDesign, OpeningKind } from '@/domain/model/schema';
import { isWindowKind } from '@/domain/model/schema';
import { OPENING_PRESETS } from '@/domain/model/defaults';
import {
  ASYM_VENT_SHARE,
  designsForKind,
  doorLeafLayout,
  leafCells,
  OPENING_DESIGNS_BY_ID,
  sashGlazing,
  topLightHeight,
  windowSpec,
  type DRect,
} from '@/domain/model/openingDesigns';
import './designs.css';

/**
 * Visual picker for door and window designs: a grid of small SVG elevations drawn from the same
 * layout data as the 3D builder (domain/model/openingDesigns.ts), for the given opening kind.
 */
export function OpeningDesignGrid({
  kind,
  value,
  onPick,
}: {
  kind: OpeningKind;
  value: OpeningDesign | null;
  onPick: (d: OpeningDesign) => void;
}) {
  const designs = designsForKind(kind);
  if (designs.length === 0) return null;
  return (
    <div className="od-grid" role="listbox" aria-label="Design">
      {designs.map((d) => (
        <button
          key={d.id}
          type="button"
          role="option"
          aria-selected={value === d.id}
          className={`od-cell${value === d.id ? ' on' : ''}`}
          title={`${d.label}: ${d.hint}`}
          onClick={() => onPick(d.id)}
        >
          <DesignPreview kind={kind} design={d.id} />
          <span className="od-label">{d.label}</span>
        </button>
      ))}
    </div>
  );
}

const PAD = 0.06;

/** SVG elevation of an opening kind in a design (preset proportions, metres, y up). */
export function DesignPreview({ kind, design }: { kind: OpeningKind; design: OpeningDesign }) {
  const p = OPENING_PRESETS[kind];
  const W = p.width;
  const H = p.height;
  const barn = kind === 'door-barn';
  const x0 = barn ? -0.12 : 0;
  const vbW = W - 2 * x0 + 2 * PAD;
  const vbH = H + 2 * PAD + (barn ? 0.12 : 0);
  return (
    <svg
      className="od-svg"
      viewBox={`${x0 - PAD} ${-H - PAD - (barn ? 0.12 : 0)} ${vbW} ${vbH}`}
      aria-hidden
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Content is drawn with y up: flip once here. */}
      <g transform="scale(1,-1)">
        {isWindowKind(kind) ? (
          <WindowElevation kind={kind} design={design} W={W} H={H} />
        ) : (
          <DoorElevation kind={kind} design={design} W={W} H={H} />
        )}
      </g>
    </svg>
  );
}

const rect = (r: DRect, cls: string, key?: string | number) => (
  <rect
    key={key}
    className={cls}
    x={r.x0}
    y={r.y0}
    width={Math.max(0, r.x1 - r.x0)}
    height={Math.max(0, r.y1 - r.y0)}
  />
);

/** Parallel hatch lines across `r` (vertical when `vertical`), roughly `step` apart. */
function hatch(r: DRect, step: number, vertical: boolean, cls: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const len = vertical ? r.x1 - r.x0 : r.y1 - r.y0;
  const n = Math.max(1, Math.round(len / step));
  for (let i = 1; i < n; i++) {
    const v = (vertical ? r.x0 : r.y0) + (len * i) / n;
    out.push(
      vertical ? (
        <line key={`${key}${i}`} className={cls} x1={v} y1={r.y0} x2={v} y2={r.y1} />
      ) : (
        <line key={`${key}${i}`} className={cls} x1={r.x0} y1={v} x2={r.x1} y2={v} />
      ),
    );
  }
  return out;
}

function DoorLeaf({
  design,
  w,
  h,
  x,
  mirror,
  brace,
}: {
  design: OpeningDesign;
  w: number;
  h: number;
  x: number;
  mirror?: boolean;
  brace?: boolean;
}) {
  const layout = doorLeafLayout(design, w, h, { brace });
  const metal = !!OPENING_DESIGNS_BY_ID[design]?.material;
  const glassCls = layout.glass === 'frosted' ? 'od-frosted' : 'od-glass';
  const els: ReactNode[] = [
    rect({ x0: 0, y0: 0, x1: w, y1: h }, metal ? 'od-leaf od-metal' : 'od-leaf', 'leaf'),
  ];
  leafCells(layout, w, h).forEach((c, i) => {
    if (c.type === 'recess') els.push(rect(c, 'od-recess', `c${i}`));
    else if (c.type === 'groove') els.push(rect(c, 'od-groove', `c${i}`));
    else if (c.type === 'lite') {
      els.push(rect(c, glassCls, `c${i}`));
      if (layout.glass === 'reeded') els.push(...hatch(c, 0.03, true, 'od-reed', `r${i}`));
    } else if (c.type === 'void') els.push(rect(c, 'od-void', `c${i}`));
  });
  layout.bars.forEach((b, i) => els.push(rect(b, metal ? 'od-bar od-metal' : 'od-bar', `b${i}`)));
  layout.flutes.forEach((r, i) => els.push(...hatch(r, 0.035, true, 'od-flute', `f${i}`)));
  layout.louvres.forEach((r, i) => els.push(...hatch(r, 0.06, false, 'od-flute', `l${i}`)));
  layout.battens.forEach((r, i) => els.push(rect(r, 'od-batten', `t${i}`)));
  if (layout.brace && layout.battens.length >= 2) {
    const [lo, hi] = layout.battens;
    els.push(<line key="brace" className="od-brace" x1={0.12} y1={lo.y1} x2={w - 0.12} y2={hi.y0} />);
  }
  return <g transform={mirror ? `translate(${x + w},0) scale(-1,1)` : `translate(${x},0)`}>{els}</g>;
}

function DoorElevation({
  kind,
  design,
  W,
  H,
}: {
  kind: OpeningKind;
  design: OpeningDesign;
  W: number;
  H: number;
}) {
  const f = 0.05;
  const iw = W - 2 * f;
  const lh = H - f;
  const leaves: ReactNode[] = [];
  if (kind === 'door-double' || kind === 'door-french') {
    leaves.push(
      <DoorLeaf key="a" design={design} w={iw / 2} h={lh} x={f} />,
      <DoorLeaf key="b" design={design} w={iw / 2} h={lh} x={f + iw / 2} mirror />,
    );
  } else if (kind === 'door-sliding') {
    const pw = iw * 0.55;
    leaves.push(
      <DoorLeaf key="b" design={design} w={pw} h={lh} x={W - f - pw} />,
      <DoorLeaf key="a" design={design} w={pw} h={lh} x={f} />,
    );
  } else if (kind === 'door-bifold') {
    const n = W >= 1.2 - 1e-6 ? 4 : 2;
    for (let k = 0; k < n; k++)
      leaves.push(
        <DoorLeaf
          key={k}
          design={design}
          w={iw / n - 0.004}
          h={lh - 0.015}
          x={f + (iw * k) / n + 0.002}
          mirror={k % 2 === 1}
        />,
      );
  } else if (kind === 'door-barn') {
    leaves.push(
      <rect key="rail" className="od-rail" x={-0.12} y={H + 0.05} width={W + 0.24} height={0.03} />,
    );
    leaves.push(<DoorLeaf key="a" design={design} w={W + 0.1} h={H + 0.03} x={-0.05} brace />);
  } else leaves.push(<DoorLeaf key="a" design={design} w={iw} h={lh} x={f} />);
  return (
    <>
      <path className="od-frame" d={`M0 0 V${H} H${W} V0 H${W - f} V${H - f} H${f} V0 Z`} />
      {leaves}
    </>
  );
}

function Sash({
  design,
  x,
  y,
  w,
  h,
  share,
  sf,
}: {
  design: OpeningDesign;
  x: number;
  y: number;
  w: number;
  h: number;
  share: number;
  sf: number;
}) {
  const spec = windowSpec(design);
  const s = Math.min(sf, w / 4, h / 4);
  const gw = w - 2 * s;
  const gh = h - 2 * s;
  const g = sashGlazing(design, gw, gh, share);
  const els: ReactNode[] = [
    rect({ x0: 0, y0: 0, x1: w, y1: h }, 'od-wframe', 'f'),
    rect({ x0: s, y0: s, x1: w - s, y1: h - s }, 'od-glass', 'g'),
  ];
  if (spec.glass === 'reeded')
    els.push(...hatch({ x0: s, y0: s, x1: w - s, y1: h - s }, 0.04, true, 'od-reed', 'r'));
  if (g.frosted)
    els.push(
      rect(
        { x0: s + g.frosted.x0, y0: s + g.frosted.y0, x1: s + g.frosted.x1, y1: s + g.frosted.y1 },
        'od-frosted',
        'fr',
      ),
    );
  g.bars.forEach((b, i) =>
    els.push(rect({ x0: s + b.x0, y0: s + b.y0, x1: s + b.x1, y1: s + b.y1 }, 'od-wframe', `b${i}`)),
  );
  return <g transform={`translate(${x},${y})`}>{els}</g>;
}

function WindowElevation({
  kind,
  design,
  W,
  H,
}: {
  kind: OpeningKind;
  design: OpeningDesign;
  W: number;
  H: number;
}) {
  const spec = windowSpec(design);
  const f = spec.frame;
  const light = design === 'win-tilt-turn';
  const frameCls = light ? 'od-wframe od-light' : 'od-wframe';
  const sf = spec.sash;
  const els: ReactNode[] = [];
  if (kind === 'window-round') {
    const r = Math.min(W, H) / 2;
    const gr = r - f;
    els.push(
      <circle key="o" className={frameCls} cx={W / 2} cy={H / 2} r={r} />,
      <circle
        key="g"
        className={design === 'win-reeded' ? 'od-frosted' : 'od-glass'}
        cx={W / 2}
        cy={H / 2}
        r={gr}
      />,
    );
    if (design === 'win-grid-2x2') {
      els.push(
        rect(
          { x0: W / 2 - gr, y0: H / 2 - spec.bar / 2, x1: W / 2 + gr, y1: H / 2 + spec.bar / 2 },
          'od-wframe',
          'h',
        ),
      );
      els.push(
        rect(
          { x0: W / 2 - spec.bar / 2, y0: H / 2 - gr, x1: W / 2 + spec.bar / 2, y1: H / 2 + gr },
          'od-wframe',
          'v',
        ),
      );
    }
    return <g className={light ? 'od-light-wrap' : undefined}>{els}</g>;
  }
  const iw = W - 2 * f;
  const ih = H - 2 * f;
  if (kind === 'window-arched') {
    const b = Math.min(W / 2, H * 0.6);
    const ys = H - b;
    els.push(<path key="o" className={frameCls} d={`M0 0 V${ys} A${W / 2} ${b} 0 0 0 ${W} ${ys} V0 Z`} />);
    els.push(
      <path
        key="fan"
        className={design === 'win-reeded' ? 'od-frosted' : 'od-glass'}
        d={`M${f} ${ys} A${W / 2 - f} ${b - f} 0 0 0 ${W - f} ${ys} Z`}
      />,
    );
    const sh = ys - f / 2 - f;
    if (sh > 0.1) {
      if (iw >= 1.0) {
        els.push(
          <Sash key="a" design={design} x={f} y={f} w={iw / 2} h={sh} share={0.5} sf={sf} />,
          <Sash key="b" design={design} x={f + iw / 2} y={f} w={iw / 2} h={sh} share={0.5} sf={sf} />,
        );
      } else els.push(<Sash key="a" design={design} x={f} y={f} w={iw} h={sh} share={1} sf={sf} />);
    }
    return <g className={light ? 'od-light-wrap' : undefined}>{els}</g>;
  }
  els.push(rect({ x0: 0, y0: 0, x1: W, y1: H }, frameCls, 'o'));
  const tl = spec.topLight ? topLightHeight(ih) : 0;
  const sh = tl > 0 ? ih - tl - f : ih;
  if (tl > 0) els.push(rect({ x0: f, y0: f + sh + f, x1: W - f, y1: H - f }, 'od-glass', 'tl'));
  const sash = (key: string, x: number, w: number) => (
    <Sash key={key} design={design} x={x} y={f} w={w} h={sh} share={w / iw} sf={sf} />
  );
  if (spec.mullion && iw > 0.45) {
    const vw = iw * ASYM_VENT_SHARE;
    els.push(sash('v', f, vw), sash('x', f + vw + f, iw - vw - f));
  } else if (kind === 'window-double' || kind === 'window-sliding' || (kind === 'window-tall' && iw >= 1.4)) {
    els.push(sash('a', f, iw / 2), sash('b', f + iw / 2, iw / 2));
  } else els.push(sash('a', f, iw));
  return <g className={light ? 'od-light-wrap' : undefined}>{els}</g>;
}

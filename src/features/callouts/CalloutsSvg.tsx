import type { ReactNode } from 'react';
import type { Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { layoutCallout, textWidth, visibleCallouts, type CalloutLayout } from './layout';

const f = (n: number) => (Math.abs(n) < 1e-9 ? '0' : n.toFixed(4).replace(/\.?0+$/, ''));
const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join('') + 'Z';

interface Props {
  project: Project;
  derived: DerivedPlan;
  /** World size of one screen pixel or print point. */
  px: number;
  fontFamily: string;
  /** Selected callout ids (drawn heavier). */
  highlight?: ReadonlySet<string>;
  /** Links are clickable (exports: a transparent <a> over each link, which SVG viewers and the PDF converter both keep); on the editor canvas they are styled text. */
  links?: boolean;
}

/** Callouts on the plan: target outline, leader, anchor dot and the label box with formatted text. */
export function CalloutsSvg({ project, derived, px, fontFamily, highlight, links }: Props) {
  const items = visibleCallouts(project)
    .map((c) => layoutCallout(project, derived, c, px))
    .filter((l): l is CalloutLayout => !!l);
  if (!items.length) return null;
  // Two passes: every outline and leader first, then the labels, so no outline crosses another callout's label.
  return (
    <g className="plan-callouts">
      {items.map((l) => (
        <CalloutMarks key={`m-${l.callout.id}`} l={l} px={px} on={!!highlight?.has(l.callout.id)} />
      ))}
      {items.map((l) => (
        <CalloutSvg key={l.callout.id} l={l} px={px} font={fontFamily} on={!!highlight?.has(l.callout.id)} links={!!links} />
      ))}
    </g>
  );
}

/** Target outline, leader (from the anchor to the label edge) and anchor dot. */
function CalloutMarks({ l, px, on }: { l: CalloutLayout; px: number; on: boolean }) {
  const { anchor, attach, colors } = l;
  const parts: ReactNode[] = [];
  if (anchor.outline) {
    parts.push(
      <path
        key="outline"
        d={path(anchor.outline)}
        fill={colors.main}
        fillOpacity={l.callout.target.kind === 'object' ? 0.12 : 0.08}
        stroke={colors.main}
        strokeWidth={f((on ? 1.8 : 1.2) * px)}
        strokeDasharray={`${f(5 * px)} ${f(3 * px)}`}
        strokeLinejoin="round"
      />,
    );
  }
  parts.push(
    <line key="leader" x1={f(anchor.x)} y1={f(anchor.y)} x2={f(attach.x)} y2={f(attach.y)} stroke={colors.main} strokeWidth={f((on ? 1.8 : 1.3) * px)} strokeLinecap="round" />,
    <circle key="dot" cx={f(anchor.x)} cy={f(anchor.y)} r={f(4 * px)} fill={colors.main} stroke="#fff" strokeWidth={f(1.4 * px)} />,
  );
  return (
    <g className="plan-callout-marks" data-callout-marks={l.callout.id}>
      {parts}
    </g>
  );
}

/** The label: box, accent stripe and formatted text (plus link hotspots in exports). */
function CalloutSvg({ l, px, font, on, links }: { l: CalloutLayout; px: number; font: string; on: boolean; links: boolean }) {
  const { box, colors } = l;
  const r = 4 * px;
  const parts: ReactNode[] = [
    <rect
      key="box"
      x={f(box.x)}
      y={f(box.y)}
      width={f(box.w)}
      height={f(box.h)}
      rx={f(r)}
      fill={colors.fill}
      stroke={colors.main}
      strokeWidth={f((on ? 2 : 1.1) * px)}
    />,
    <rect key="stripe" x={f(box.x)} y={f(box.y)} width={f(3.5 * px)} height={f(box.h)} rx={f(1.5 * px)} fill={colors.main} />,
  ];
  l.lines.forEach((line, i) => {
    const size = line.role === 'info' ? l.font * 0.92 : l.font;
    const y = box.y + l.pad + l.font * 0.82 + i * l.lineH;
    const x = box.x + l.pad + 3 * px + line.indent * l.font * 0.54;
    parts.push(
      <text
        key={`t${i}`}
        x={f(x)}
        y={f(y)}
        fontSize={f(size)}
        fontFamily={font}
        fill={line.role === 'info' ? '#55626b' : colors.text}
        fontWeight={line.role === 'title' ? 650 : undefined}
      >
        {line.runs.map((run, k) => (
          <tspan
            key={k}
            fontWeight={run.bold ? 650 : undefined}
            fontStyle={run.italic ? 'italic' : undefined}
            fill={run.href ? colors.main : undefined}
            textDecoration={run.href ? 'underline' : undefined}
          >
            {run.text}
          </tspan>
        ))}
      </text>,
    );
    if (!links) return;
    let rx = x;
    line.runs.forEach((run, k) => {
      const w = textWidth({ runs: [run], role: line.role, indent: 0 }, size);
      if (run.href)
        parts.push(
          <a key={`a${i}-${k}`} href={run.href} target="_blank" rel="noopener noreferrer">
            <rect x={f(rx)} y={f(y - size * 0.85)} width={f(w)} height={f(size * 1.1)} fill="#000" fillOpacity={0} />
          </a>,
        );
      rx += w;
    });
  });
  return (
    <g className="plan-callout" data-callout={l.callout.id}>
      {parts}
    </g>
  );
}

import { useEffect, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { Callout, Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { floatingInsets, type Insets } from '@/components/layoutInsets';
import { CalloutCard } from './CalloutCard';
import { visibleCallouts } from './layout';
import { callout3DPoints } from './Callouts3D';
import { inView, placeNoteLabels, screenBounds, type LabelInput, type NotePlacement, type PlacedLabel } from './placement';
import { NOTE_LINE_WIDTH, arrowHead, endPx, labelColors, leaderDash } from './style';

export interface NoteOnScreen {
  c: Callout;
  anchor: { x: number; y: number };
  placed: PlacedLabel;
}

const _v = new THREE.Vector3();

/** Projects a world point to pixels in a w × h view; null when it is behind the camera. */
function toScreen(p: THREE.Vector3, camera: THREE.Camera, w: number, h: number) {
  _v.copy(p).project(camera);
  if (_v.z > 1 || _v.z < -1) return null;
  return { x: ((_v.x + 1) / 2) * w, y: ((1 - _v.y) / 2) * h };
}

/** The building's box (plan bounds, floor to the highest wall top) as a screen rectangle. */
function buildingRect(project: Project, derived: DerivedPlan, camera: THREE.Camera, w: number, h: number) {
  const b = derived.bounds;
  if (!b) return null;
  const top = Math.max(0, ...Object.values(project.walls).map((wl) => (wl.baseElevation ?? 0) + wl.height));
  const corners: ({ x: number; y: number } | null)[] = [];
  for (const x of [b.minX, b.maxX]) for (const y of [0, top]) for (const z of [b.minY, b.maxY]) corners.push(toScreen(new THREE.Vector3(x, y, z), camera, w, h));
  return corners.some((p) => !p) ? null : screenBounds(corners);
}

/**
 * Screen layout of the visible notes for a camera: where each note points, and its label rectangle
 * after placement (close / further / clear of the walls) and without overlaps where space allows.
 * `size` gives a label's pixel size (measured DOM cards, or canvas text in captures).
 */
export function layoutNotes3D(
  project: Project,
  derived: DerivedPlan,
  camera: THREE.Camera,
  w: number,
  h: number,
  size: (c: Callout) => { w: number; h: number } | null,
  insets?: Insets,
): NoteOnScreen[] {
  const mode: NotePlacement = project.render.notePlacement ?? 'close';
  const inputs: (LabelInput & { c: Callout })[] = [];
  for (const c of visibleCallouts(project)) {
    const pts = callout3DPoints(project, derived, c, mode);
    if (!pts) continue;
    const anchor = toScreen(pts.anchor, camera, w, h);
    const prefer = toScreen(pts.label, camera, w, h);
    const s = size(c);
    // Notes on things out of view are not pinned to the edge of the view.
    if (!anchor || !prefer || !s || !inView(anchor, { w, h })) continue;
    inputs.push({ id: c.id, c, anchor, prefer, w: s.w, h: s.h });
  }
  const placed = placeNoteLabels(inputs, { w, h }, { mode, insets, obstacle: mode === 'clear' ? buildingRect(project, derived, camera, w, h) : null });
  return inputs.map((it, i) => ({ c: it.c, anchor: it.anchor, placed: placed[i] }));
}

/** Inside the Canvas: keeps `target` pointing at the current camera, for the overlay outside it. */
export function NotesViewBridge({ target }: { target: MutableRefObject<THREE.Camera | null> }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    target.current = camera;
    return () => {
      if (target.current === camera) target.current = null;
    };
  }, [camera, target]);
  return null;
}

/** Leader and end mark of one note, as SVG updated every frame. */
function NoteMarks({ c, on, refs }: { c: Callout; on: boolean; refs: Map<string, { line?: SVGLineElement | null; end?: SVGElement | null }> }) {
  const main = labelColors(c).main;
  const dash = leaderDash(c);
  const set = (k: 'line' | 'end') => (el: SVGElement | null) => {
    const r = refs.get(c.id) ?? {};
    (r as Record<string, unknown>)[k] = el;
    refs.set(c.id, r);
  };
  return (
    <g>
      {c.line !== 'none' && (
        <line
          ref={set('line')}
          stroke={main}
          strokeWidth={NOTE_LINE_WIDTH[c.lineWeight] * 1.15 * (on ? 1.5 : 1)}
          strokeDasharray={dash?.join(' ')}
          strokeLinecap="round"
        />
      )}
      {(c.end === 'dot' || c.end === 'ring') && (
        <circle
          ref={set('end')}
          r={endPx(c) * (on ? 1.2 : 1)}
          fill={c.end === 'dot' ? main : '#fff'}
          stroke={c.end === 'dot' ? '#fff' : main}
          strokeWidth={c.end === 'dot' ? 1.4 : Math.max(1.6, endPx(c) / 2.6)}
        />
      )}
      {c.end === 'arrow' && <path ref={set('end')} fill={main} stroke="#fff" strokeWidth={0.8} strokeLinejoin="round" />}
    </g>
  );
}

/**
 * Note labels over the 3D view: HTML cards and SVG leaders laid out on screen every frame (see
 * `layoutNotes3D`), so labels can keep clear of each other and of the building. The floor highlight
 * stays in the scene (`Callouts3D`). In the editor a click selects a note and a double-click edits it.
 */
export function NotesOverlay({
  project,
  derived,
  camera,
  visible,
  selectedIds,
  onSelect,
  onEdit,
}: {
  project: Project;
  derived: DerivedPlan;
  camera: MutableRefObject<THREE.Camera | null>;
  visible: boolean;
  selectedIds?: ReadonlySet<string>;
  onSelect?: (id: string, additive: boolean) => void;
  onEdit?: (id: string) => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const cards = useRef(new Map<string, HTMLDivElement | null>());
  const marks = useRef(new Map<string, { line?: SVGLineElement | null; end?: SVGElement | null }>());
  const latest = useRef({ project, derived, visible });
  latest.current = { project, derived, visible };
  const notes = visible ? visibleCallouts(project) : [];

  useEffect(() => {
    let raf = 0;
    // Floating panels covering the view, measured a few times a second.
    let insets: Insets = { l: 0, r: 0, t: 0, b: 0 };
    let insetsAt = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = layer.current;
      const cam = camera.current;
      const { project: p, derived: d, visible: v } = latest.current;
      if (!el) return;
      if (!v || !cam) {
        el.style.visibility = 'hidden';
        return;
      }
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      el.style.visibility = '';
      const now = performance.now();
      if (now - insetsAt > 300) {
        insets = floatingInsets(el.getBoundingClientRect());
        insetsAt = now;
      }
      const shown = new Set<string>();
      for (const n of layoutNotes3D(p, d, cam, w, h, (c) => {
        const card = cards.current.get(c.id);
        return card ? { w: card.offsetWidth, h: card.offsetHeight } : null;
      }, insets)) {
        shown.add(n.c.id);
        const { rect, attach } = n.placed;
        const card = cards.current.get(n.c.id);
        if (card) {
          card.style.transform = `translate(${Math.round(rect.x)}px, ${Math.round(rect.y)}px)`;
          card.style.visibility = '';
        }
        const m = marks.current.get(n.c.id);
        if (m?.line) {
          m.line.setAttribute('x1', String(n.anchor.x));
          m.line.setAttribute('y1', String(n.anchor.y));
          m.line.setAttribute('x2', String(attach.x));
          m.line.setAttribute('y2', String(attach.y));
          m.line.style.visibility = '';
        }
        if (m?.end) {
          if (m.end.tagName === 'circle') {
            m.end.setAttribute('cx', String(n.anchor.x));
            m.end.setAttribute('cy', String(n.anchor.y));
          } else {
            const from = Math.hypot(attach.x - n.anchor.x, attach.y - n.anchor.y) > 1 ? attach : { x: n.anchor.x, y: n.anchor.y - 10 };
            m.end.setAttribute('d', arrowHead(n.anchor, from, endPx(n.c)).map((q, i) => `${i ? 'L' : 'M'}${q.x} ${q.y}`).join('') + 'Z');
          }
          m.end.style.visibility = '';
        }
      }
      // Notes whose target is behind the camera.
      for (const [id, card] of cards.current) if (card && !shown.has(id)) card.style.visibility = 'hidden';
      for (const [id, m] of marks.current)
        if (!shown.has(id)) for (const e of [m.line, m.end]) if (e) e.style.visibility = 'hidden';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [camera]);

  return (
    <div ref={layer} className="notes-layer" aria-hidden={!visible}>
      <svg className="notes-marks" width="100%" height="100%">
        {notes.map((c) => (
          <NoteMarks key={`${c.id}-${c.line}-${c.end}`} c={c} on={!!selectedIds?.has(c.id)} refs={marks.current} />
        ))}
      </svg>
      {notes.map((c) => (
        <div
          key={c.id}
          ref={(el) => {
            if (el) cards.current.set(c.id, el);
            else cards.current.delete(c.id);
          }}
          className={`callout-3d${onSelect ? '' : ' passive'}`}
          style={{ visibility: 'hidden' }}
          data-testid="callout-3d"
          data-callout-id={c.id}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(c.id, e.shiftKey);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onEdit?.(c.id);
          }}
        >
          <CalloutCard project={project} derived={derived} callout={c} selected={!!selectedIds?.has(c.id)} />
        </div>
      ))}
    </div>
  );
}

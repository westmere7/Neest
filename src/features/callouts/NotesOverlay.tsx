import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { Callout, Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { calloutAnchor, setCalloutAnchorPoint } from '@/domain/geometry/callouts';
import { floatingInsets, type Insets } from '@/components/layoutInsets';
import { useProjectStore } from '@/state/projectStore';
import { liveScene } from '@/features/scene-3d/sceneRuntime';
import { CalloutCard, NOTE_IMAGE_GLYPH } from './CalloutCard';
import { visibleCallouts } from './layout';
import { callout3DPoints } from './Callouts3D';
import { inView, placeNoteLabels, screenBounds, type LabelInput, type NotePlacement, type PlacedLabel, type ScreenRect } from './placement';
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
  avoid?: ScreenRect[],
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
  const placed = placeNoteLabels(inputs, { w, h }, { mode, insets, avoid, obstacle: mode === 'clear' ? buildingRect(project, derived, camera, w, h) : null });
  return inputs.map((it, i) => ({ c: it.c, anchor: it.anchor, placed: placed[i] }));
}

/** Where each visible note points on screen (null when out of view): the 3D "Icons" display puts its pin there. */
function noteAnchors(project: Project, derived: DerivedPlan, camera: THREE.Camera, w: number, h: number): Map<string, { x: number; y: number } | null> {
  const out = new Map<string, { x: number; y: number } | null>();
  for (const c of visibleCallouts(project)) {
    const pts = callout3DPoints(project, derived, c, project.render.notePlacement ?? 'close');
    const a = pts ? toScreen(pts.anchor, camera, w, h) : null;
    out.set(c.id, a && inView(a, { w, h }) ? a : null);
  }
  return out;
}

/** A speech-bubble glyph for note pins. */
const PIN_GLYPH = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M8 9h8M8 13h5" />
  </svg>
);

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

type MarkEls = { line?: SVGLineElement | null; end?: SVGElement | null; hit?: SVGCircleElement | null };

/** Leader and end mark of one note, as SVG updated every frame. */
function NoteMarks({
  c,
  on,
  refs,
  onAnchorDown,
}: {
  c: Callout;
  on: boolean;
  refs: Map<string, MarkEls>;
  onAnchorDown?: (e: React.PointerEvent<SVGCircleElement>, id: string) => void;
}) {
  const main = labelColors(c).main;
  const dash = leaderDash(c);
  const set = (k: keyof MarkEls) => (el: SVGElement | null) => {
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
      {onAnchorDown && (
        <circle
          ref={set('hit')}
          r={9}
          fill="transparent"
          style={{ pointerEvents: 'auto', cursor: 'grab' }}
          data-testid="callout-anchor-3d"
          data-callout-id={c.id}
          onPointerDown={(e) => onAnchorDown(e, c.id)}
        />
      )}
    </g>
  );
}

/**
 * Note labels over the 3D view: HTML cards and SVG leaders laid out on screen every frame (see
 * `layoutNotes3D`), so labels can keep clear of each other and of the building. The floor highlight
 * stays in the scene (`Callouts3D`). In the editor a click selects a note, dragging its anchor dot
 * moves the spot it points to, and a double-click edits it.
 *
 * `render.noteDisplay`: cards, or pins on each spot ("Icons"); a pin opens its note's card (and so does
 * selecting the note), another click closes it. Long notes are cut after a few lines with "…" unless
 * opened or selected. Notes with pictures carry a picture badge.
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
  const pins = useRef(new Map<string, HTMLButtonElement | null>());
  const marks = useRef(new Map<string, MarkEls>());
  const display = project.render.noteDisplay ?? 'full';
  const [openId, setOpenId] = useState<string | null>(null);
  /** Notes shown as full cards in "Icons": the opened one and the selected ones. */
  const opened = new Set([...(openId ? [openId] : []), ...(selectedIds ?? [])]);
  const latest = useRef({ project, derived, visible, display, opened });
  latest.current = { project, derived, visible, display, opened };
  const notes = visible ? visibleCallouts(project) : [];

  const handleAnchorDown = (e: React.PointerEvent<SVGCircleElement>, id: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect?.(id, e.shiftKey);
    const { project: p0, derived: d0 } = latest.current;
    if (p0.layers.callouts?.locked) return;
    const c0 = p0.callouts?.[id];
    const a0 = c0 ? calloutAnchor(p0, d0, c0.target) : null;
    const cam = camera.current;
    const host = layer.current;
    if (!c0 || !a0 || !cam || !host) return;

    const startScreen = { x: e.clientX, y: e.clientY };
    const anchor3D = new THREE.Vector3(a0.x, a0.z, a0.y);
    const camDir = new THREE.Vector3();
    cam.getWorldDirection(camDir);
    const midairPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, anchor3D);
    const raycaster = new THREE.Raycaster();
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      if (!moved) {
        if (Math.hypot(ev.clientX - startScreen.x, ev.clientY - startScreen.y) < 4) return;
        moved = true;
        useProjectStore.getState().begin('Move note spot');
      }
      const rect = host.getBoundingClientRect();
      const ndc = new THREE.Vector2(((ev.clientX - rect.left) / rect.width) * 2 - 1, -((ev.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, cam);

      let hitPoint: THREE.Vector3 | null = null;
      const scene = liveScene.current?.scene;
      if (scene && !ev.shiftKey) {
        const targets = ['objects', 'walls', 'openings', 'rooms']
          .map((n) => scene.getObjectByName(n))
          .filter((x): x is THREE.Object3D => !!x);
        const hits = targets.length ? raycaster.intersectObjects(targets, true) : [];
        if (hits.length) hitPoint = hits[0].point.clone();
      }
      if (!hitPoint) {
        const p = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(midairPlane, p)) hitPoint = p;
      }
      if (!hitPoint) return;

      const next = { x: hitPoint.x, y: hitPoint.z, z: Math.max(0, hitPoint.y) };
      const curDerived = latest.current.derived;
      useProjectStore.getState().preview((d) => {
        const c = d.callouts?.[id];
        if (c) setCalloutAnchorPoint(d, curDerived, c, next, true);
      });
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      if (moved) useProjectStore.getState().commit();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  useEffect(() => {
    let raf = 0;
    // Floating panels covering the view, measured a few times a second.
    let insets: Insets = { l: 0, r: 0, t: 0, b: 0 };
    let insetsAt = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = layer.current;
      const cam = camera.current;
      const { project: p, derived: d, visible: v, display: disp, opened: open } = latest.current;
      if (!el) return;
      if (!v || !cam) {
        el.style.visibility = 'hidden';
        return;
      }
      if (disp !== 'icon') for (const pin of pins.current.values()) if (pin) pin.style.visibility = 'hidden';
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
      // Icons: a pin on every spot; only opened notes get a card and a leader, kept clear of the pins.
      const pinRects: ScreenRect[] = [];
      if (disp === 'icon') {
        const at = noteAnchors(p, d, cam, w, h);
        for (const a of at.values()) if (a) pinRects.push({ x: a.x - 15, y: a.y - 36, w: 30, h: 36 });
        for (const [id, pin] of pins.current) {
          const a = at.get(id);
          if (!pin) continue;
          pin.style.visibility = a ? '' : 'hidden';
          if (a) pin.style.transform = `translate(${Math.round(a.x)}px, ${Math.round(a.y)}px)`;
        }
      }
      for (const n of layoutNotes3D(p, d, cam, w, h, (c) => {
        if (disp === 'icon' && !open.has(c.id)) return null;
        const card = cards.current.get(c.id);
        return card ? { w: card.offsetWidth, h: card.offsetHeight } : null;
      }, insets, pinRects)) {
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
        if (m?.hit) {
          m.hit.setAttribute('cx', String(n.anchor.x));
          m.hit.setAttribute('cy', String(n.anchor.y));
          m.hit.style.visibility = '';
        }
      }
      // Notes whose target is behind the camera.
      for (const [id, card] of cards.current) if (card && !shown.has(id)) card.style.visibility = 'hidden';
      for (const [id, m] of marks.current)
        if (!shown.has(id)) for (const e of [m.line, m.end, m.hit]) if (e) e.style.visibility = 'hidden';
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [camera]);

  return (
    <div ref={layer} className="notes-layer" aria-hidden={!visible}>
      <svg className="notes-marks" width="100%" height="100%">
        {notes.map((c) => (
          <NoteMarks
            key={`${c.id}-${c.line}-${c.end}`}
            c={c}
            on={!!selectedIds?.has(c.id)}
            refs={marks.current}
            onAnchorDown={onSelect ? handleAnchorDown : undefined}
          />
        ))}
      </svg>
      {display === 'icon' &&
        notes.map((c) => (
          <button
            key={`pin-${c.id}`}
            type="button"
            ref={(el) => {
              if (el) pins.current.set(c.id, el);
              else pins.current.delete(c.id);
            }}
            className={`note-pin${openId === c.id ? ' open' : ''}${selectedIds?.has(c.id) ? ' selected' : ''}`}
            style={{ visibility: 'hidden', '--callout-main': labelColors(c).main } as React.CSSProperties}
            aria-label="Open note"
            aria-expanded={opened.has(c.id)}
            data-testid="note-pin"
            data-callout-id={c.id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setOpenId((cur) => (cur === c.id ? null : c.id));
              onSelect?.(c.id, e.shiftKey);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onEdit?.(c.id);
            }}
          >
            {PIN_GLYPH}
            {c.images.length > 0 && <span className="callout-img-badge">{NOTE_IMAGE_GLYPH}</span>}
          </button>
        ))}
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
          <CalloutCard project={project} derived={derived} callout={c} selected={!!selectedIds?.has(c.id)} clip={!opened.has(c.id)} />
        </div>
      ))}
    </div>
  );
}

import { NEST_MARK } from '@/components/nestMark';
import './sceneLoading.css';

/** What the 3D view is waiting for, in order. */
export type SceneLoadStage = 'code' | 'scene' | 'materials' | 'frames';

const STAGES: { id: SceneLoadStage; label: string }[] = [
  { id: 'code', label: 'Loading the 3D engine' },
  { id: 'scene', label: 'Building walls, rooms and furniture' },
  { id: 'materials', label: 'Preparing materials and lights' },
  { id: 'frames', label: 'Drawing the first frames' },
];

/**
 * Loading screen of the 3D view: the nest mark with its layers lighting up in turn, the current
 * step in words and a four-step progress track. Kept free of three.js so it can show while the 3D
 * code itself is still downloading.
 */
export function SceneLoading({ stage, progress, className = '' }: { stage: SceneLoadStage; progress?: { done: number; total: number } | null; className?: string }) {
  const i = STAGES.findIndex((s) => s.id === stage);
  return (
    <div className={`pane-loading scene-loading ${className}`} role="status" aria-live="polite" data-testid="scene-loading" data-stage={stage}>
      <div className="sl-card">
        {/* The nest mark, its layers lighting up in turn from the centre outward ("Ripple"). */}
        <svg className="sl-art" viewBox={NEST_MARK.viewBox} aria-hidden>
          {NEST_MARK.paths.map((d, k) => (
            <path key={k} className={`sl-layer sl-l${k}`} d={d} />
          ))}
        </svg>
        <div className="sl-label">
          {STAGES[Math.max(0, i)].label}…
          {progress && progress.total > 0 && (
            <span className="sl-count num">
              {' '}
              {progress.done} / {progress.total} textures
            </span>
          )}
        </div>
        <ol className="sl-steps" aria-label="Loading steps">
          {STAGES.map((s, k) => (
            <li key={s.id} className={k < i ? 'done' : k === i ? 'now' : ''} title={s.label} />
          ))}
        </ol>
      </div>
    </div>
  );
}

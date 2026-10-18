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
 * Loading screen of the 3D view: a little plan that draws itself and rises into walls, the current
 * step in words and a four-step progress track. Kept free of three.js so it can show while the 3D
 * code itself is still downloading.
 */
export function SceneLoading({ stage, progress, className = '' }: { stage: SceneLoadStage; progress?: { done: number; total: number } | null; className?: string }) {
  const i = STAGES.findIndex((s) => s.id === stage);
  return (
    <div className={`pane-loading scene-loading ${className}`} role="status" aria-live="polite" data-testid="scene-loading" data-stage={stage}>
      <div className="sl-card">
        <svg className="sl-art" viewBox="0 0 120 90" aria-hidden>
          <g className="sl-iso">
            {/* Floor plan outline drawing itself, then walls rising from it. */}
            <path className="sl-plan" d="M10 50 L60 25 L110 50 L60 75 Z" />
            <path className="sl-plan sl-inner" d="M35 37.5 L85 62.5 M60 25 L60 50 L35 62.5" />
            <path className="sl-wall sl-w1" d="M10 50 L60 25 L60 5 L10 30 Z" />
            <path className="sl-wall sl-w2" d="M60 25 L110 50 L110 30 L60 5 Z" />
            <path className="sl-wall sl-w3" d="M35 37.5 L60 25 L60 12 L35 24.5 Z" />
            <circle className="sl-dot" cx="60" cy="50" r="2.4" />
          </g>
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

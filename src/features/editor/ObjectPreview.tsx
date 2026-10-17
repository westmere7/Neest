import { useEffect, useRef, useState } from 'react';
import type { Project } from '@/domain/model/schema';
import { getAsset } from '@/data/assets/registry';
import { usePackVersion } from '@/packs/events';
import { AssetPlanThumb } from '@/features/library/LibraryPanel';
import type { PreviewHandle } from '@/features/scene-3d/objectPreview';

type State = 'loading' | 'ok' | 'fallback';

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Small live 3D view of a placed object for the Inspector: slowly turns, drag to turn it by hand.
 * The renderer (lazy-loaded with three) is one shared canvas, see `scene-3d/objectPreview.ts`.
 * Falls back to the 2D plan symbol when WebGL or an imported model isn't available.
 */
export function ObjectPreview({ project, objectId }: { project: Project; objectId: string }) {
  const o = project.objects[objectId];
  const asset = getAsset(project, o.assetId);
  const packs = usePackVersion();
  const hostRef = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState<PreviewHandle | null>(null);
  const [state, setState] = useState<State>('loading');
  const latest = useRef({ o, project });
  latest.current = { o, project };

  // Attach the shared renderer once per mount; detaching stops all rendering.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let h: PreviewHandle | null = null;
    import('@/features/scene-3d/objectPreview')
      .then((m) => {
        if (cancelled) return;
        h = m.attachPreview(host, { reducedMotion: prefersReducedMotion(), onFail: () => setState('fallback') });
        if (h) setHandle(h);
        else setState('fallback');
      })
      .catch(() => {
        if (!cancelled) setState('fallback');
      });
    return () => {
      cancelled = true;
      h?.detach();
    };
  }, []);

  // Rebuild when what the model looks like changes (not when it is moved or rotated in the plan).
  const look = `${o.id}|${o.assetId}|${o.width}|${o.depth}|${o.height}|${o.mirrored}|${JSON.stringify(o.materials)}|${packs}`;
  const materials = project.materials;
  useEffect(() => {
    if (!handle) return;
    let alive = true;
    const { o: obj, project: p } = latest.current;
    void handle.show(obj, p).then((r) => {
      if (alive && r !== 'stale') setState(r);
    });
    return () => {
      alive = false;
    };
  }, [handle, look, materials]);

  const label = o.name ?? asset?.name ?? 'Object';
  return (
    <div
      ref={hostRef}
      className={`object-preview is-${state}`}
      role="img"
      aria-label={state === 'ok' ? `3D preview of ${label}. Drag to turn it.` : `Plan symbol of ${label}`}
      title={state === 'ok' ? 'Drag to turn' : undefined}
      data-testid="object-preview"
    >
      {state === 'fallback' && asset && <AssetPlanThumb asset={asset} />}
    </div>
  );
}

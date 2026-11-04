import { useEffect, useState } from 'react';
import { Camera, Square } from 'lucide-react';
import { useProjectStore } from '@/state/projectStore';
import { useEditorStore } from '@/state/editorStore';

/**
 * The 3D view's views, in the canvas controls group at the bottom right (beside Snapping): Top, then
 * every saved view of the View panel in its order. A click moves the camera there (`requestCamera`, so
 * a saved view also brings its wall display and field of view); the view clicked last stays marked until
 * the camera is moved by hand (a press or a scroll on the 3D canvas). Many views scroll sideways.
 */
export function ViewButtons() {
  const cameras = useProjectStore((s) => s.project!.cameras);
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    // On the page, not the canvas: the 3D canvas may mount after this group (it loads lazily).
    const clear = (e: Event) => {
      if ((e.target as Element | null)?.matches?.('.scene3d canvas')) setActive(null);
    };
    window.addEventListener('pointerdown', clear, true);
    window.addEventListener('wheel', clear, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', clear, true);
      window.removeEventListener('wheel', clear, true);
    };
  }, []);
  // A saved view that was deleted is no longer marked.
  const shown = active === 'top' || cameras.some((c) => c.id === active) ? active : null;
  const go = (id: string) => {
    useEditorStore.getState().requestCamera(id);
    setActive(id);
  };
  return (
    <div className="views-rail" role="group" aria-label="Views" data-testid="views-rail">
      <button
        type="button"
        className={`views-rail-btn${shown === 'top' ? ' on' : ''}`}
        aria-pressed={shown === 'top'}
        title="Top view"
        onClick={() => go('top')}
        data-testid="views-rail-top"
      >
        <Square size={13} /> Top
      </button>
      {cameras.length > 0 && (
        <div
          className="views-rail-list"
          onWheel={(e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY;
          }}
        >
          {cameras.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`views-rail-btn${shown === c.id ? ' on' : ''}`}
              aria-pressed={shown === c.id}
              title={`Go to ${c.name}`}
              onClick={() => go(c.id)}
            >
              <Camera size={13} /> {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

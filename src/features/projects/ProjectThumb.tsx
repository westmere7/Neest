import { useEffect, useRef, useState } from 'react';
import { generateThumbnail, thumbnailSrc } from './thumbnails';

export interface ThumbSource {
  key: string;
  load: () => Promise<unknown | null>;
  /** Called with a freshly rendered thumbnail so it can be stored. */
  persist?: (svg: string) => void;
}

/** Plan preview of a project card; renders one on demand when none is stored. */
export function ProjectThumb({ stored, source, empty }: { stored: string | null; source: ThumbSource | null; empty: React.ReactNode }) {
  const [rendered, setRendered] = useState<{ key: string; svg: string | null } | null>(null);
  const key = source?.key ?? null;
  const latest = useRef(source);
  latest.current = source;
  useEffect(() => {
    const src = latest.current;
    if (!key || !src) return;
    let alive = true;
    void generateThumbnail(key, src.load).then((svg) => {
      if (!alive) return;
      setRendered({ key, svg });
      if (svg) src.persist?.(svg);
    });
    return () => {
      alive = false;
    };
  }, [key]);
  const done = key !== null && rendered?.key === key;
  const svg = done ? (rendered.svg ?? stored) : stored;
  if (svg)
    return (
      <div className="thumb">
        <img src={thumbnailSrc(svg)} alt="" draggable={false} />
      </div>
    );
  if (key && !done) return <div className="thumb loading" aria-busy="true" />;
  return <div className="thumb empty">{empty}</div>;
}

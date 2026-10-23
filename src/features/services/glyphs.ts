import type { ServicePointKind, ServiceSystem } from '@/domain/model/services';

/**
 * Line glyphs on a 24 × 24 box, drawn in white on a coloured marker: plan SVG, 3D sprites (Path2D)
 * and the library and panel icons all use these. `fill` paths are filled instead of stroked.
 * A dot is a zero-length segment with a round cap.
 */
export interface Glyph {
  stroke: string[];
  fill?: string[];
}

const ring = (r: number) => `M${12 - r} 12a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const BOLT = 'M13.2 3 6 13.2h5l-1.2 7.8 7.2-10.2h-5Z';
const DROP = 'M12 3.2s-6 7.1-6 11.2a6 6 0 0 0 12 0C18 10.3 12 3.2 12 3.2Z';

export const SYSTEM_GLYPHS: Record<ServiceSystem, Glyph> = {
  power: { stroke: [], fill: [BOLT] },
  water: { stroke: [], fill: [DROP] },
  drain: { stroke: [ring(7.5), 'M8.2 9.6h7.6', 'M7.2 12.4h9.6', 'M8.2 15.2h7.6'] },
};

export const POINT_GLYPHS: Record<ServicePointKind, Glyph> = {
  socket: { stroke: [ring(7), 'M9.6 11.6h.01', 'M14.4 11.6h.01'] },
  dedicated: { stroke: [ring(7.5)], fill: ['M12.9 6.6 8.6 12.6h3l-.8 4.8 4.4-6.2h-3Z'] },
  switch: { stroke: ['M7.5 4.5h9v15h-9Z', 'M12 8v5'] },
  light: { stroke: ['M9.2 17.2h5.6', 'M10.2 20h3.6', 'M12 4a5.6 5.6 0 0 0-3.2 10.2v1.6h6.4v-1.6A5.6 5.6 0 0 0 12 4Z'] },
  data: { stroke: ['M5 7h14v9.5H5Z', 'M9 16.5V19h6v-2.5', 'M8.5 10.5v2', 'M12 10.5v2', 'M15.5 10.5v2'] },
  panel: { stroke: ['M5.5 3.5h13v17h-13Z'], fill: ['M12.9 6.4 8.8 12.4h2.9l-.8 5.2 4.3-6.4h-2.9Z'] },
  'water-cold': { stroke: [DROP] },
  'water-hot': { stroke: [DROP, 'M9 15c1-1.2 2 1.2 3 0s2 1.2 3 0'] },
  'hose-tap': { stroke: ['M4 9.5h7.5a4.5 4.5 0 0 1 4.5 4.5v1.5', 'M8 9.5V6', 'M5 6h6', 'M16 18.5v1.5'] },
  'water-main': { stroke: [ring(7.5), 'M12 12.5l3.2-3.2', 'M8.6 16h6.8'] },
  'floor-drain': { stroke: ['M5 5h14v14H5Z', 'M5 9.7h14', 'M5 14.3h14', 'M9.7 5v14', 'M14.3 5v14'] },
  waste: { stroke: [ring(7), ring(3)] },
  'toilet-outlet': { stroke: [ring(8), ring(4.5)] },
  stack: { stroke: [ring(8), 'M12 7.5v8.5', 'M8.8 13l3.2 3.2 3.2-3.2'] },
};

/** A flat-sided hexagon centred on (cx, cy): the mains' marker shape. */
export function hexagonPath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + r * Math.cos(a)).toFixed(3)} ${(cy + r * Math.sin(a)).toFixed(3)}`;
  });
  return `M${pts.join('L')}Z`;
}

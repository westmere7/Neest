import type { WallRole, WallSegment, WallSideFinish, WallStyle } from './schema';

/**
 * Named wall types for the Build tab: a role, size, construction style, finishes and trims in one
 * click. "Left" and "right" are relative to the drawing direction (left = left of a → b); the
 * Inspector's "Swap sides" flips them.
 */
export interface WallPreset {
  id: string;
  label: string;
  hint: string;
  role: WallRole;
  thickness: number;
  /** Absent = the project's default wall height. */
  height?: number;
  style?: WallStyle;
  materials?: Partial<WallSegment['materials']>;
  styleMaterialId?: string;
  finishes?: { left?: WallSideFinish; right?: WallSideFinish };
  /** Icon hint for the Build card. */
  icon: 'solid' | 'trim' | 'panel' | 'tile' | 'brick' | 'glass' | 'railing-glass' | 'railing-bars' | 'half' | 'block';
}

const skirting = (materialId = 'paint-satin-white'): WallSideFinish['skirting'] => ({ height: 0.1, depth: 0.015, materialId });
const cornice = (materialId = 'paint-satin-white'): WallSideFinish['cornice'] => ({ height: 0.08, depth: 0.05, materialId });
const finish = (f: Partial<WallSideFinish>): WallSideFinish => ({ skirting: null, cornice: null, rail: null, band: null, ...f });

export const WALL_PRESETS: WallPreset[] = [
  {
    id: 'trimmed-interior',
    label: 'Wall with skirting & cornice',
    hint: 'Interior wall with white skirting boards and a cornice on both faces.',
    role: 'interior',
    thickness: 0.12,
    icon: 'trim',
    finishes: { left: finish({ skirting: skirting(), cornice: cornice() }), right: finish({ skirting: skirting(), cornice: cornice() }) },
  },
  {
    id: 'wainscot',
    label: 'Panelled wainscot wall',
    hint: 'Painted timber panelling to dado height with a cap rail, plus skirting (left face).',
    role: 'interior',
    thickness: 0.12,
    icon: 'panel',
    finishes: {
      left: finish({ band: { height: 0.95, depth: 0.018, materialId: 'wood-painted-white', cap: true }, skirting: skirting() }),
      right: finish({ skirting: skirting() }),
    },
  },
  {
    id: 'tiled-dado',
    label: 'Tiled dado wall',
    hint: 'Subway tile to 1.2 m on the left face — kitchens and bathrooms.',
    role: 'interior',
    thickness: 0.12,
    icon: 'tile',
    finishes: { left: finish({ band: { height: 1.2, depth: 0.008, materialId: 'tile-subway-white', cap: false } }) },
  },
  {
    id: 'picture-rail',
    label: 'Wall with picture rail',
    hint: 'Skirting, a picture rail at 2.1 m and a cornice on both faces.',
    role: 'interior',
    thickness: 0.12,
    icon: 'trim',
    finishes: {
      left: finish({ skirting: skirting(), cornice: cornice(), rail: { y: 2.1, height: 0.04, depth: 0.02, materialId: 'paint-satin-white' } }),
      right: finish({ skirting: skirting(), cornice: cornice(), rail: { y: 2.1, height: 0.04, depth: 0.02, materialId: 'paint-satin-white' } }),
    },
  },
  {
    id: 'brick-plaster',
    label: 'Brick outside, plaster inside',
    hint: 'Exterior wall: exposed brick on the left face, smooth plaster with skirting on the right.',
    role: 'exterior',
    thickness: 0.3,
    icon: 'brick',
    materials: { left: 'brick-red', right: 'paint-warm-white' },
    finishes: { right: finish({ skirting: skirting() }) },
  },
  {
    id: 'stud-partition',
    label: 'Stud partition',
    hint: 'Light 10 cm partition with skirting on both faces.',
    role: 'partition',
    thickness: 0.1,
    icon: 'solid',
    finishes: { left: finish({ skirting: skirting() }), right: finish({ skirting: skirting() }) },
  },
  {
    id: 'glass-wall',
    label: 'Glass wall',
    hint: 'Framed glazed wall with mullions — offices, studios, shower rooms.',
    role: 'partition',
    thickness: 0.08,
    style: 'glass',
    icon: 'glass',
    materials: { top: 'metal-black-matte' },
    styleMaterialId: 'glass-clear',
  },
  {
    id: 'glass-block',
    label: 'Glass block wall',
    hint: 'Translucent glass block partition.',
    role: 'partition',
    thickness: 0.1,
    icon: 'block',
    materials: { left: 'glass-block', right: 'glass-block', top: 'glass-block' },
  },
  {
    id: 'half-wall',
    label: 'Half wall with cap',
    hint: '1.05 m wall with an oak capping board — pass-throughs and stair edges.',
    role: 'partition',
    thickness: 0.12,
    height: 1.05,
    style: 'half',
    icon: 'half',
    materials: { top: 'wood-oak-light' },
  },
  {
    id: 'glass-railing',
    label: 'Glass balcony railing',
    hint: 'Steel posts and handrail with glass panels, 1.05 m.',
    role: 'exterior',
    thickness: 0.06,
    height: 1.05,
    style: 'railing-glass',
    icon: 'railing-glass',
    materials: { top: 'metal-brushed-steel' },
    styleMaterialId: 'glass-clear',
  },
  {
    id: 'bar-railing',
    label: 'Metal balcony railing',
    hint: 'Black metal posts, handrail and vertical bars, 1.05 m.',
    role: 'exterior',
    thickness: 0.06,
    height: 1.05,
    style: 'railing-bars',
    icon: 'railing-bars',
    materials: { top: 'metal-black-matte' },
    styleMaterialId: 'metal-black-matte',
  },
];

export const WALL_PRESETS_BY_ID: Record<string, WallPreset> = Object.fromEntries(WALL_PRESETS.map((p) => [p.id, p]));

/** Material ids a preset uses (for copying catalogue materials into the project). */
export function presetMaterialIds(p: WallPreset): string[] {
  const ids = new Set<string>();
  for (const m of Object.values(p.materials ?? {})) if (m) ids.add(m);
  if (p.styleMaterialId) ids.add(p.styleMaterialId);
  for (const f of [p.finishes?.left, p.finishes?.right]) {
    for (const layer of [f?.skirting, f?.cornice, f?.rail, f?.band]) if (layer) ids.add(layer.materialId);
  }
  return [...ids];
}

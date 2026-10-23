import type { CameraPreset, GuestSettings, Project, RenderSettings } from '@/domain/model/schema';

/** Saved views offered to guests, in the chosen order (all of them, in project order, when none were chosen). */
export function guestViews(project: Pick<Project, 'cameras' | 'guest'>): CameraPreset[] {
  const ids = project.guest.viewIds;
  if (!ids) return project.cameras;
  const byId = new Map(project.cameras.map((c) => [c.id, c]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** The automatic views offered after the saved ones (none named like a saved view, so no duplicate buttons). */
export function guestAutoViews(project: Pick<Project, 'cameras' | 'guest'>): ('Overview' | 'Top')[] {
  if (!project.guest.overviewViews) return [];
  const taken = new Set(guestViews(project).map((c) => c.name.trim().toLowerCase()));
  return (['Overview', 'Top'] as const).filter((n) => !taken.has(n.toLowerCase()));
}

export const guestTitle = (p: Pick<Project, 'name' | 'guest'>): string => p.guest.title.trim() || p.name;
export const guestSubtitle = (p: Pick<Project, 'guest'>): string =>
  p.guest.subtitle.trim() || 'View-only 3D walkthrough';

/** The 3D render quality used for a guest quality setting. */
export const guestRenderQuality = (g: Pick<GuestSettings, 'quality'>): RenderSettings['quality'] =>
  g.quality === 'fast' ? 'draft' : g.quality;

/**
 * The project as guests first see it: the guest overrides (time of day, background, quality, shadows,
 * walkthrough FOV, ceilings, walls, room labels) applied to its render settings. Item layers keep
 * their visibility (hidden ones, when included, start hidden).
 */
export function guestSceneProject(project: Project): Project {
  const g = project.guest;
  const r = project.render;
  const render: RenderSettings = {
    ...r,
    timeOfDay: g.timeOfDay ?? r.timeOfDay,
    background: g.background ?? r.background,
    shadows: g.shadows,
    quality: guestRenderQuality(g),
    walkFov: g.walkFov ?? r.walkFov,
    showCeilings: g.ceilings,
    wallDisplay: g.wallDisplay,
    cutawayHeight: g.cutawayHeight,
    showRoomLabels: g.roomLabels,
  };
  return { ...project, render };
}

/** Item layers guests can toggle: id ('' = Unassigned), name, colour and whether it starts shown. */
export interface GuestLayer {
  id: string;
  name: string;
  color?: string;
  on: boolean;
}

/** The item layers offered to guests (those with items; hidden ones only when `hiddenItems` is on). */
export function guestLayers(
  project: Pick<Project, 'objects' | 'itemLayers' | 'layers' | 'guest'>,
): GuestLayer[] {
  const ids = new Set(project.itemLayers.map((l) => l.id));
  const used = new Set(
    Object.values(project.objects)
      .filter((o) => !o.hidden)
      .map((o) => (o.layerId && ids.has(o.layerId) ? o.layerId : '')),
  );
  const all: GuestLayer[] = [
    ...project.itemLayers.map((l) => ({ id: l.id, name: l.name, color: l.color, on: l.visible })),
    { id: '', name: 'Unassigned', on: project.layers.unassigned.visible },
  ];
  return all.filter((l) => used.has(l.id) && (l.on || project.guest.hiddenItems));
}

/** The guest layer id of an item ('' = Unassigned, which includes items of deleted layers). */
export function guestLayerId(project: Pick<Project, 'itemLayers'>, o: { layerId?: string }): string {
  return o.layerId && project.itemLayers.some((l) => l.id === o.layerId) ? o.layerId : '';
}

/** Time-of-day choices offered for guests (hours). */
export const GUEST_TIMES: { value: number; label: string }[] = [
  { value: 8, label: 'Morning (8:00)' },
  { value: 12, label: 'Midday (12:00)' },
  { value: 16, label: 'Afternoon (16:00)' },
  { value: 18.5, label: 'Golden hour (18:30)' },
  { value: 20.5, label: 'Evening (20:30)' },
];

import type { Project } from '@/domain/model/schema';
import { derivePlan } from '@/domain/geometry/derive';
import { materialUsage } from '@/domain/commands/entities';
import { OPENING_PRESETS, ROOM_TYPE_LABELS } from '@/domain/model/defaults';
import { getAsset, objectSlotMaterialId, resolveMaterial } from '@/data/assets/registry';

/** Machine-readable summary of rooms, openings, furniture inventory and material usage. */
export function buildReport(project: Project) {
  const derived = derivePlan(project);
  const rooms = derived.faces.map((f, i) => {
    const r = derived.faceRooms[i];
    return {
      name: r?.name ?? 'Room',
      type: r ? ROOM_TYPE_LABELS[r.type] : 'Room',
      areaM2: round(f.area),
      perimeterM: round(f.perimeter),
      extentM: { width: round(f.bounds.maxX - f.bounds.minX), depth: round(f.bounds.maxY - f.bounds.minY) },
      floor: resolveMaterial(project, r?.floorMaterialId).name,
      ceiling: resolveMaterial(project, r?.ceilingMaterialId).name,
    };
  });
  const openings: Record<string, number> = {};
  for (const o of Object.values(project.openings)) openings[OPENING_PRESETS[o.kind].label] = (openings[OPENING_PRESETS[o.kind].label] ?? 0) + 1;
  const inventory = new Map<string, { item: string; category: string; count: number; sizes: Set<string> }>();
  const usedMaterials = new Map<string, number>();
  for (const o of Object.values(project.objects)) {
    const a = getAsset(project, o.assetId);
    const key = o.assetId;
    const entry = inventory.get(key) ?? { item: a?.name ?? o.assetId, category: a?.category ?? 'unknown', count: 0, sizes: new Set<string>() };
    entry.count++;
    entry.sizes.add(`${round(o.width)} × ${round(o.depth)} × ${round(o.height)} m`);
    inventory.set(key, entry);
    for (const slot of a?.slots ?? []) {
      const id = objectSlotMaterialId(o, a, slot.id);
      usedMaterials.set(id, (usedMaterials.get(id) ?? 0) + 1);
    }
  }
  const materialIds = new Set<string>([...Object.keys(project.materials), ...usedMaterials.keys()]);
  const materials = [...materialIds]
    .map((id) => {
      const m = resolveMaterial(project, id);
      const surfaces = materialUsage(project, id).length + (project.materials[id] ? 0 : usedMaterials.get(id) ?? 0);
      return { name: m.name, category: m.category, color: m.color, surfaces, source: m.source.license };
    })
    .filter((m) => m.surfaces > 0)
    .sort((a, b) => b.surfaces - a.surfaces);
  const walls = Object.values(project.walls);
  return {
    generator: 'Neest',
    note: 'Planning summary — not a certified survey or construction document.',
    project: project.name,
    generatedAt: new Date().toISOString(),
    units: 'metres',
    totals: {
      rooms: rooms.length,
      netFloorAreaM2: round(rooms.reduce((s, r) => s + r.areaM2, 0)),
      wallLengthM: round([...derived.network.walls.values()].reduce((s, g) => s + g.path.length, 0)),
      walls: walls.length,
      objects: Object.keys(project.objects).length,
    },
    rooms,
    openings,
    inventory: [...inventory.values()].map((e) => ({ ...e, sizes: [...e.sizes] })).sort((a, b) => a.category.localeCompare(b.category)),
    materials,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

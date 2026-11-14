import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { updateMaterial, updateObjects } from '@/domain/commands/entities';
import { inEveryOption } from '@/domain/commands/options';
import { useProjectStore } from '@/state/projectStore';
import { applyPacks } from './runtime';

/**
 * Loads every content pack: one file per pack, /packs/<pack-id>.pack.ts (see /packs/README.md).
 * Files whose name starts with "_" (such as _template.pack.ts) are ignored.
 *
 * Live reload: this module accepts its own hot updates, and Vite re-runs it whenever a pack file
 * is added, edited or removed. Each run re-applies all packs, and the open app (library, plan and
 * 3D) updates without a page refresh.
 */
const modules = import.meta.glob(['/packs/*.pack.ts', '!/packs/_*'], { eager: true });

applyPacks(modules);

const mintCat = MATERIAL_CATALOG_BY_ID['sage-shaker-kitchen:mint-stack-tile'];
const shieldCat = MATERIAL_CATALOG_BY_ID['sage-shaker-kitchen:tempered-glass'];
const openProject = useProjectStore.getState().project;
if (openProject) {
  const staleMintIds = mintCat
    ? Object.values(openProject.materials)
        .filter((m) => (m.id === mintCat.id || m.catalogId === mintCat.id) && m.color.toLowerCase() === '#d2e6c2')
        .map((m) => m.id)
    : [];
  const staleShieldIds = shieldCat
    ? Object.values(openProject.materials)
        .filter(
          (m) =>
            (m.id === shieldCat.id || m.catalogId === shieldCat.id) &&
            m.color.toLowerCase() === '#cfe4e2' &&
            Math.abs(m.opacity - 0.36) < 1e-4,
        )
        .map((m) => m.id)
    : [];
  const isOldKitchen = (o: { assetId: string; width: number; height: number }) =>
    ((o.assetId === 'sage-shaker-kitchen:l-kitchen' || o.assetId === 'sage-shaker-kitchen:l-kitchen-right') && Math.abs(o.height - 2.6) < 1e-4) ||
    (o.assetId === 'kitchen-counters:run-240-sink-hob' && o.height < 1.8) ||
    (o.assetId === 'compact-living:swivel-tv-stand' && o.width < 1.15);
  const hasOldKitchen =
    Object.values(openProject.objects).some(isOldKitchen) ||
    (openProject.options ?? []).some((opt) => Object.values(opt.plan?.objects ?? {}).some(isOldKitchen));

  if (staleMintIds.length || staleShieldIds.length || hasOldKitchen) {
    useProjectStore.getState().execute('Update kitchen pack defaults', (d) => {
      if (mintCat) {
        for (const id of staleMintIds) updateMaterial(d, id, { color: mintCat.color, roughness: mintCat.roughness });
      }
      if (shieldCat) {
        for (const id of staleShieldIds) {
          updateMaterial(d, id, {
            name: shieldCat.name,
            color: shieldCat.color,
            roughness: shieldCat.roughness,
            opacity: shieldCat.opacity,
          });
        }
      }
      if (hasOldKitchen) {
        inEveryOption(d, (p) => {
          for (const o of Object.values(p.objects)) {
            if (!isOldKitchen(o)) continue;
            if (o.assetId === 'kitchen-counters:run-240-sink-hob') {
              updateObjects(p, [o.id], { height: 2.22, materials: {} });
            } else if (o.assetId === 'compact-living:swivel-tv-stand') {
              updateObjects(p, [o.id], { width: 1.22, depth: 0.5, height: 1.48, materials: {} });
            } else {
              updateObjects(p, [o.id], { height: 2.22 });
            }
          }
        });
      }
    });
  }
}

if (import.meta.hot) import.meta.hot.accept();


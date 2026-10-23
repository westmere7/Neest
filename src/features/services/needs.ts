import type { PlacedObject, Project } from '@/domain/model/schema';
import type { DerivedPlan } from '@/domain/geometry/derive';
import { resolveServices, type NeedsOf, type ServicesState } from '@/domain/geometry/services';
import type { AssetServices } from '@/domain/model/services';
import { getAsset } from '@/data/assets/registry';

/** What a placed item needs, from its library item. */
export const needsOfProject =
  (project: Pick<Project, 'customAssets'>): NeedsOf =>
  (o: PlacedObject): AssetServices | undefined =>
    getAsset(project, o.assetId)?.services;

// One resolve per project/plan version: the plan, the 3D view, the panel and the Inspector share it.
let cache: { project: Project; derived: DerivedPlan; value: ServicesState } | null = null;

/** Connections and unmet needs of the open plan (memoised on the project and derived plan). */
export function servicesState(project: Project, derived: DerivedPlan): ServicesState {
  if (cache && cache.project === project && cache.derived === derived) return cache.value;
  const value = resolveServices(project, derived, needsOfProject(project));
  cache = { project, derived, value };
  return value;
}

import { PROJECT_FORMAT, ProjectSchema, SCHEMA_VERSION, type Project } from '@/domain/model/schema';
import { MATERIAL_CATALOG_BY_ID } from '@/data/materials/catalog';
import { upgradeRetiredItem } from '@/data/assets/models';

export class ProjectImportError extends Error {
  constructor(
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = 'ProjectImportError';
  }
}

type RawProject = Record<string, unknown>;

/**
 * Step migrations keyed by the version they upgrade FROM. Each returns data in
 * the next version's shape. Version 1 is the first public schema, so there are
 * no steps yet; add entries here when SCHEMA_VERSION increases.
 */
const MIGRATIONS: Record<number, (raw: RawProject) => RawProject> = {};

export interface MigrationResult {
  project: Project;
  /** Repairs applied (e.g. dangling references removed). Shown to the user. */
  warnings: string[];
}

/** Validates, migrates, and repairs raw project data from storage or an import. */
export function migrateProject(input: unknown): MigrationResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ProjectImportError('This file does not contain a Neest project.');
  }
  let raw = { ...(input as RawProject) };
  if (raw.format !== undefined && raw.format !== PROJECT_FORMAT) {
    throw new ProjectImportError('This file is not a Neest project (unknown format identifier).');
  }
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : NaN;
  if (!Number.isInteger(version)) throw new ProjectImportError('The project file is missing its schema version.');
  if (version > SCHEMA_VERSION) {
    throw new ProjectImportError(
      `This project was saved by a newer version of Neest (schema ${version}); this version supports up to ${SCHEMA_VERSION}.`,
    );
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new ProjectImportError(`No migration available from schema version ${version}.`);
    raw = step(raw);
    version += 1;
    raw.schemaVersion = version;
  }
  attachCatalogPhotos(raw);
  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new ProjectImportError('The project data is invalid or corrupted.', details);
  }
  return repairProject(parsed.data);
}

/**
 * Materials saved before photo textures existed have no photo (missing or
 * null). Give catalogue copies (and overrides of them) the catalogue's photo
 * texture when their procedural pattern is still the catalogue one, so older
 * projects pick up photo textures without a schema bump. Switching a material
 * to procedural keeps its photo with `enabled: false`, which is preserved.
 */
function attachCatalogPhotos(raw: RawProject): void {
  const mats = raw.materials;
  if (!mats || typeof mats !== 'object' || Array.isArray(mats)) return;
  const all = mats as Record<string, unknown>;
  const catalogOf = (m: Record<string, unknown>, depth = 0): string | null => {
    if (typeof m.catalogId === 'string') return m.catalogId;
    const parent = typeof m.overrideOf === 'string' ? all[m.overrideOf] : undefined;
    if (typeof m.overrideOf === 'string' && MATERIAL_CATALOG_BY_ID[m.overrideOf] && !parent) return m.overrideOf;
    return parent && typeof parent === 'object' && depth < 4 ? catalogOf(parent as Record<string, unknown>, depth + 1) : null;
  };
  for (const value of Object.values(all)) {
    if (!value || typeof value !== 'object') continue;
    const m = value as Record<string, unknown>;
    if (m.photo !== undefined && m.photo !== null) continue;
    const id = catalogOf(m);
    const cat = id ? MATERIAL_CATALOG_BY_ID[id] : undefined;
    if (!cat?.photo) continue;
    const pattern = (m.texture as { patternId?: unknown } | null | undefined)?.patternId ?? null;
    if (pattern !== (cat.texture?.patternId ?? null)) continue;
    m.photo = { ...cat.photo };
  }
}

/** Removes dangling references so the editor never renders broken geometry. */
export function repairProject(project: Project): MigrationResult {
  const warnings: string[] = [];
  const p = project;
  for (const [key, n] of Object.entries(p.nodes)) {
    if (n.id !== key) n.id = key;
  }
  let droppedWalls = 0;
  for (const [key, w] of Object.entries(p.walls)) {
    if (w.id !== key) w.id = key;
    if (!p.nodes[w.a] || !p.nodes[w.b] || w.a === w.b) {
      delete p.walls[key];
      droppedWalls++;
    }
  }
  if (droppedWalls) warnings.push(`${droppedWalls} wall(s) referenced missing endpoints and were removed.`);
  let droppedOpenings = 0;
  for (const [key, o] of Object.entries(p.openings)) {
    if (o.id !== key) o.id = key;
    if (!p.walls[o.wallId]) {
      delete p.openings[key];
      droppedOpenings++;
    }
  }
  if (droppedOpenings) warnings.push(`${droppedOpenings} door/window(s) referenced missing walls and were removed.`);
  for (const [key, o] of Object.entries(p.objects)) if (o.id !== key) o.id = key;
  // Separate empty/styled version items became model variants of the original item.
  let upgraded = 0;
  for (const o of Object.values(p.objects)) if (upgradeRetiredItem(o)) upgraded++;
  for (const opt of p.options ?? []) for (const o of Object.values(opt.plan?.objects ?? {})) if (upgradeRetiredItem(o)) upgraded++;
  if (upgraded) warnings.push(`${upgraded} retired item(s) replaced: empty or styled versions now use the original item with a model variant, look-alike branded items the one kept.`);
  for (const [key, r] of Object.entries(p.rooms)) if (r.id !== key) r.id = key;
  for (const [key, m] of Object.entries(p.materials)) if (m.id !== key) m.id = key;
  const camIds = new Set<string>();
  p.cameras = p.cameras.filter((c) => (camIds.has(c.id) ? false : (camIds.add(c.id), true)));
  if (p.guest.startCameraId && !camIds.has(p.guest.startCameraId)) p.guest.startCameraId = null;
  return { project: p, warnings };
}

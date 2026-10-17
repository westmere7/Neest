import { PROJECT_FORMAT, ProjectSchema, SCHEMA_VERSION, type Project } from '@/domain/model/schema';

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
  const parsed = ProjectSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new ProjectImportError('The project data is invalid or corrupted.', details);
  }
  return repairProject(parsed.data);
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
  for (const [key, r] of Object.entries(p.rooms)) if (r.id !== key) r.id = key;
  for (const [key, m] of Object.entries(p.materials)) if (m.id !== key) m.id = key;
  const camIds = new Set<string>();
  p.cameras = p.cameras.filter((c) => (camIds.has(c.id) ? false : (camIds.add(c.id), true)));
  if (p.guest.startCameraId && !camIds.has(p.guest.startCameraId)) p.guest.startCameraId = null;
  return { project: p, warnings };
}

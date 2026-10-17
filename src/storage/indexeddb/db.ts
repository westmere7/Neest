import Dexie, { type Table } from 'dexie';
import type { Project } from '@/domain/model/schema';
import type {
  BlobRepository,
  PreferenceRepository,
  ProjectRepository,
  ProjectSaveMeta,
  ProjectSummary,
  StoredBlob,
} from '../repository';

interface ProjectDocRecord {
  id: string;
  doc: unknown;
}

interface PrefRecord {
  key: string;
  value: unknown;
}

class NeestDatabase extends Dexie {
  projectMeta!: Table<ProjectSummary, string>;
  projectDocs!: Table<ProjectDocRecord, string>;
  blobs!: Table<StoredBlob, string>;
  prefs!: Table<PrefRecord, string>;

  constructor(name = 'neest') {
    super(name);
    this.version(1).stores({
      projectMeta: 'id, updatedAt, name',
      projectDocs: 'id',
      blobs: 'id, createdAt',
      prefs: 'key',
    });
  }
}

let db: NeestDatabase | null = null;
export function getDb(): NeestDatabase {
  if (!db) db = new NeestDatabase();
  return db;
}

/** For tests: use a fresh database name. */
export function resetDbForTests(name: string) {
  db = new NeestDatabase(name);
}

export class IndexedDbProjectRepository implements ProjectRepository {
  async list(): Promise<ProjectSummary[]> {
    const rows = await getDb().projectMeta.toArray();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async loadRaw(id: string): Promise<unknown | null> {
    const rec = await getDb().projectDocs.get(id);
    return rec?.doc ?? null;
  }

  async save(project: Project, meta: ProjectSaveMeta = {}): Promise<void> {
    const d = getDb();
    await d.transaction('rw', d.projectMeta, d.projectDocs, async () => {
      const prev = await d.projectMeta.get(project.id);
      await d.projectDocs.put({ id: project.id, doc: project });
      await d.projectMeta.put({
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        thumbnail: meta.thumbnail !== undefined ? meta.thumbnail : (prev?.thumbnail ?? null),
        roomCount: meta.roomCount ?? prev?.roomCount ?? Object.keys(project.rooms).length,
        objectCount: meta.objectCount ?? Object.keys(project.objects).length,
        area: meta.area ?? prev?.area ?? 0,
      });
    });
  }

  async rename(id: string, name: string): Promise<void> {
    const d = getDb();
    await d.transaction('rw', d.projectMeta, d.projectDocs, async () => {
      const rec = await d.projectDocs.get(id);
      if (!rec) return;
      const doc = { ...(rec.doc as Project), name, updatedAt: Date.now() };
      await d.projectDocs.put({ id, doc });
      await d.projectMeta.update(id, { name, updatedAt: doc.updatedAt });
    });
  }

  async setThumbnail(id: string, thumbnail: string | null): Promise<void> {
    await getDb().projectMeta.update(id, { thumbnail });
  }

  async delete(id: string): Promise<void> {
    const d = getDb();
    await d.transaction('rw', d.projectMeta, d.projectDocs, async () => {
      await d.projectMeta.delete(id);
      await d.projectDocs.delete(id);
    });
  }

  /** Blob ids referenced by all stored projects (for garbage collection). */
  async referencedBlobIds(): Promise<Set<string>> {
    const out = new Set<string>();
    await getDb().projectDocs.each((rec) => {
      const doc = rec.doc as Partial<Project> | null;
      for (const a of Object.values(doc?.customAssets ?? {})) out.add(a.blobId);
    });
    return out;
  }
}

export class IndexedDbBlobRepository implements BlobRepository {
  async put(blob: Omit<StoredBlob, 'createdAt'>): Promise<void> {
    await getDb().blobs.put({ ...blob, createdAt: Date.now() });
  }
  async get(id: string): Promise<StoredBlob | null> {
    return (await getDb().blobs.get(id)) ?? null;
  }
  async delete(id: string): Promise<void> {
    await getDb().blobs.delete(id);
  }
  async collectGarbage(referenced: Set<string>): Promise<number> {
    const all = await getDb().blobs.toCollection().primaryKeys();
    const stale = all.filter((k) => !referenced.has(k));
    await getDb().blobs.bulkDelete(stale);
    return stale.length;
  }
}

export class IndexedDbPreferenceRepository implements PreferenceRepository {
  async get<T>(key: string): Promise<T | undefined> {
    return (await getDb().prefs.get(key))?.value as T | undefined;
  }
  async set<T>(key: string, value: T): Promise<void> {
    await getDb().prefs.put({ key, value });
  }
}

export const projectRepository = new IndexedDbProjectRepository();
export const blobRepository = new IndexedDbBlobRepository();
export const preferenceRepository = new IndexedDbPreferenceRepository();

import type { Project } from '@/domain/model/schema';

/**
 * Storage seam. The app talks only to these interfaces; the current
 * implementation is IndexedDB (src/storage/indexeddb). A future synced
 * backend (e.g. Cloudflare D1/R2 behind Workers) can implement the same
 * contracts and be composed with the local store for offline-first sync.
 */

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** Small SVG preview of the plan (markup string), when available. */
  thumbnail: string | null;
  roomCount: number;
  objectCount: number;
  /** Total clear floor area in m². */
  area: number;
  /** Layout options (absent in summaries saved before options were counted). */
  optionCount?: number;
}

export interface ProjectSaveMeta {
  thumbnail?: string | null;
  roomCount?: number;
  objectCount?: number;
  area?: number;
}

export interface ProjectRepository {
  list(): Promise<ProjectSummary[]>;
  /** Returns raw stored data (validated/migrated by the caller) or null. */
  loadRaw(id: string): Promise<unknown | null>;
  save(project: Project, meta?: ProjectSaveMeta): Promise<void>;
  rename(id: string, name: string): Promise<void>;
  /** Updates only the stored preview (does not touch the document or its timestamps). */
  setThumbnail(id: string, thumbnail: string | null): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface StoredBlob {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: number;
  data: Blob;
}

export interface BlobRepository {
  put(blob: Omit<StoredBlob, 'createdAt'>): Promise<void>;
  get(id: string): Promise<StoredBlob | null>;
  delete(id: string): Promise<void>;
  /** Removes blobs not referenced by any stored project. */
  collectGarbage(referenced: Set<string>): Promise<number>;
}

export interface PreferenceRepository {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
}

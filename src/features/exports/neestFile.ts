import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import type { Project } from '@/domain/model/schema';
import { SCHEMA_VERSION } from '@/domain/model/schema';
import { newId } from '@/domain/model/ids';
import { migrateProject, ProjectImportError } from '@/storage/migrations';
import { blobRepository, projectRepository } from '@/storage/indexeddb/db';

export const NEEST_FILE_FORMAT = 'neest';
export const NEEST_FILE_VERSION = 1;
export const MAX_IMPORT_BYTES = 250 * 1024 * 1024;
export const MAX_ASSET_BYTES = 60 * 1024 * 1024;

export interface NeestManifest {
  format: typeof NEEST_FILE_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  app: string;
  exportedAt: string;
  projectId: string;
  projectName: string;
  assets: { id: string; path: string; size: number; type: string; name: string }[];
}

// ───────────── Filenames & downloads ─────────────

export function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 48) || 'neest-project'
  );
}

/** Descriptive filename: <project>_<yyyy-mm-dd>_<output>.<ext> */
export function exportFilename(projectName: string, output: string, ext: string, date = new Date()): string {
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${slugify(projectName)}_${d}_${output}.${ext}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ───────────── Export ─────────────

/** Packs the project and its imported model binaries into a versioned .neest ZIP. */
export async function exportNeest(project: Project): Promise<Blob> {
  const files: Zippable = {};
  const assets: NeestManifest['assets'] = [];
  for (const a of Object.values(project.customAssets)) {
    const blob = await blobRepository.get(a.blobId);
    if (!blob) continue;
    const path = `assets/${a.blobId}.glb`;
    files[path] = [new Uint8Array(await blob.data.arrayBuffer()), { level: 0 }];
    assets.push({ id: a.blobId, path, size: blob.size, type: blob.type || 'model/gltf-binary', name: blob.name });
  }
  const manifest: NeestManifest = {
    format: NEEST_FILE_FORMAT,
    formatVersion: NEEST_FILE_VERSION,
    schemaVersion: SCHEMA_VERSION,
    app: 'Neest 0.1',
    exportedAt: new Date().toISOString(),
    projectId: project.id,
    projectName: project.name,
    assets,
  };
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2));
  files['project.json'] = strToU8(JSON.stringify(project));
  const zipped = zipSync(files, { level: 6 });
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

// ───────────── Import ─────────────

export interface ImportResult {
  project: Project;
  warnings: string[];
}

const isZip = (u8: Uint8Array) => u8.length > 4 && u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04;
const isGlb = (u8: Uint8Array) => u8.length > 12 && strFromU8(u8.subarray(0, 4)) === 'glTF';

/**
 * Validates and imports a .neest (ZIP) or raw project JSON file. Imported
 * model binaries are stored locally; the project gets a new id if one with the
 * same id already exists so nothing is overwritten.
 */
export async function importNeestFile(file: File | Blob): Promise<ImportResult> {
  if (file.size > MAX_IMPORT_BYTES) throw new ProjectImportError(`The file is too large (limit ${MAX_IMPORT_BYTES / 1024 / 1024} MB).`);
  if (file.size === 0) throw new ProjectImportError('The file is empty.');
  const u8 = new Uint8Array(await file.arrayBuffer());
  let rawProject: unknown;
  const blobs: { id: string; data: Uint8Array; name: string; type: string }[] = [];
  const warnings: string[] = [];
  if (isZip(u8)) {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(u8);
    } catch {
      throw new ProjectImportError('The .neest archive is corrupted and could not be opened.');
    }
    const manifestRaw = entries['manifest.json'];
    if (!manifestRaw) throw new ProjectImportError('This archive is missing manifest.json, so it is not a Neest project file.');
    let manifest: NeestManifest;
    try {
      manifest = JSON.parse(strFromU8(manifestRaw)) as NeestManifest;
    } catch {
      throw new ProjectImportError('The project manifest is not valid JSON.');
    }
    if (manifest.format !== NEEST_FILE_FORMAT) throw new ProjectImportError('This archive is not a Neest project file.');
    if (typeof manifest.formatVersion !== 'number' || manifest.formatVersion > NEEST_FILE_VERSION)
      throw new ProjectImportError('This file was created by a newer version of Neest.');
    const projectRaw = entries['project.json'];
    if (!projectRaw) throw new ProjectImportError('The archive does not contain project.json.');
    try {
      rawProject = JSON.parse(strFromU8(projectRaw));
    } catch {
      throw new ProjectImportError('project.json is not valid JSON.');
    }
    for (const a of manifest.assets ?? []) {
      const data = entries[a.path];
      if (!data) {
        warnings.push(`Model file "${a.name || a.path}" is missing from the archive.`);
        continue;
      }
      if (data.byteLength > MAX_ASSET_BYTES) {
        warnings.push(`Model "${a.name || a.path}" exceeds ${MAX_ASSET_BYTES / 1024 / 1024} MB and was skipped.`);
        continue;
      }
      if (!isGlb(data)) {
        warnings.push(`"${a.name || a.path}" is not a valid GLB model and was skipped.`);
        continue;
      }
      blobs.push({ id: a.id, data, name: a.name || `${a.id}.glb`, type: 'model/gltf-binary' });
    }
  } else {
    try {
      rawProject = JSON.parse(strFromU8(u8));
    } catch {
      throw new ProjectImportError('The file is neither a .neest archive nor project JSON.');
    }
  }
  const migrated = migrateProject(rawProject);
  const project = migrated.project;
  warnings.push(...migrated.warnings);

  // Drop imported models whose binaries are unavailable (they would render as placeholders forever).
  const available = new Set(blobs.map((b) => b.id));
  for (const [id, a] of Object.entries(project.customAssets)) {
    if (!available.has(a.blobId) && !(await blobRepository.get(a.blobId))) {
      warnings.push(`Imported model "${a.name}" has no data; objects using it are shown as placeholders.`);
      void id;
    }
  }
  for (const b of blobs) {
    await blobRepository.put({ id: b.id, name: b.name, type: b.type, size: b.data.byteLength, data: new Blob([b.data as BlobPart], { type: b.type }) });
  }
  const existing = await projectRepository.loadRaw(project.id);
  if (existing) {
    project.id = newId('prj');
    project.name = `${project.name} (imported)`;
  }
  return { project, warnings };
}

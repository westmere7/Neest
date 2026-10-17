import type { Project } from '@/domain/model/schema';
import { blobRepository } from './indexeddb/db';

/**
 * Client for the repository workspace (`<repo>/projects/`), served by the
 * dev/preview server plugin in tools/neest-workspace-plugin.ts. When the app
 * runs from a static host there is no workspace and every call is a no-op —
 * browser storage remains the source of truth either way.
 */

export interface WorkspaceEntry {
  id: string;
  name: string;
  updatedAt: number;
  file: string;
  size: number;
}

const BASE = '/__neest/fs';
let availability: Promise<boolean> | null = null;
let folder: string | null = null;
const uploadedBlobs = new Set<string>();

/** True when the app is served by a Neest dev/preview server with the workspace plugin. */
export function workspaceAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      if (typeof fetch === 'undefined' || typeof window === 'undefined') return false;
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1500);
        const res = await fetch(`${BASE}/health`, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(t);
        if (!res.ok) return false;
        const body = (await res.json()) as { ok?: boolean; dir?: string };
        folder = body.dir ?? 'projects';
        return body.ok === true;
      } catch {
        return false;
      }
    })();
  }
  return availability;
}

export const workspaceFolder = () => folder ?? 'projects';

export async function listWorkspace(): Promise<WorkspaceEntry[]> {
  if (!(await workspaceAvailable())) return [];
  const res = await fetch(`${BASE}/projects`, { cache: 'no-store' });
  return res.ok ? ((await res.json()) as WorkspaceEntry[]) : [];
}

export async function loadFromWorkspace(id: string): Promise<unknown | null> {
  if (!(await workspaceAvailable())) return null;
  const res = await fetch(`${BASE}/projects/${encodeURIComponent(id)}`, { cache: 'no-store' });
  return res.ok ? await res.json() : null;
}

/** Writes the project (and any imported model binaries it uses) into the repo folder. */
export async function saveToWorkspace(project: Project): Promise<void> {
  if (!(await workspaceAvailable())) return;
  for (const a of Object.values(project.customAssets)) {
    if (uploadedBlobs.has(a.blobId)) continue;
    const blob = await blobRepository.get(a.blobId);
    if (!blob) continue;
    const res = await fetch(`${BASE}/assets/${encodeURIComponent(a.blobId)}`, { method: 'PUT', body: blob.data });
    if (res.ok) uploadedBlobs.add(a.blobId);
  }
  const res = await fetch(`${BASE}/projects/${encodeURIComponent(project.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error(`Repo folder write failed (${res.status})`);
}

export async function removeFromWorkspace(id: string): Promise<void> {
  if (!(await workspaceAvailable())) return;
  await fetch(`${BASE}/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Copies model binaries referenced by a repo project into browser storage when missing. */
export async function pullWorkspaceAssets(project: Project): Promise<string[]> {
  const missing: string[] = [];
  for (const a of Object.values(project.customAssets)) {
    if (await blobRepository.get(a.blobId)) continue;
    const res = await fetch(`${BASE}/assets/${encodeURIComponent(a.blobId)}`, { cache: 'no-store' });
    if (!res.ok) {
      missing.push(a.name);
      continue;
    }
    const data = await res.blob();
    await blobRepository.put({ id: a.blobId, name: a.fileName, type: 'model/gltf-binary', size: data.size, data });
    uploadedBlobs.add(a.blobId);
  }
  return missing;
}

type Listener = (e: { id: string; kind: 'change' | 'add' | 'unlink'; file: string }) => void;
const listeners = new Set<Listener>();
let hooked = false;

/** Subscribes to on-disk changes in the repo folder (dev server only). */
export function onWorkspaceChange(fn: Listener): () => void {
  if (!hooked && import.meta.hot) {
    hooked = true;
    import.meta.hot.on('neest:projects-changed', (data: Parameters<Listener>[0]) => {
      for (const l of listeners) l(data);
    });
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

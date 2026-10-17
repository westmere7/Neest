import { migrateProject } from '@/storage/migrations';
import { renderThumbnail } from './projectService';

/**
 * On-demand plan thumbnails for projects that have none stored yet (copies in
 * the repo folder, older saves). Results are cached per project version and
 * rendered one at a time in idle time so the launcher stays responsive.
 */
const cache = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();

const idle = () =>
  new Promise<void>((resolve) => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 250 });
    else setTimeout(resolve, 16);
  });

/** Renders (once per `key`) the thumbnail of the project document returned by `load`. */
export function generateThumbnail(key: string, load: () => Promise<unknown | null>): Promise<string | null> {
  let job = cache.get(key);
  if (!job) {
    job = queue
      .then(async () => {
        await idle();
        const raw = await load();
        return raw ? renderThumbnail(migrateProject(raw).project) : null;
      })
      .catch(() => null); // an unreadable file just keeps its placeholder
    queue = job;
    cache.set(key, job);
  }
  return job;
}

export const thumbnailSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

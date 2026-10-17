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

if (import.meta.hot) import.meta.hot.accept();


import path from 'node:path';
import type { Plugin } from 'vite';

/**
 * Live content packs (dev server): when a pack file is added to or deleted from /packs, hot-reload
 * the pack loader so the open app picks the change up without a page refresh. (Edits to existing
 * pack files already hot-reload through the loader's own HMR boundary.)
 */
export function neestPacks(opts: { dir?: string; loader?: string } = {}): Plugin {
  return {
    name: 'neest-packs',
    apply: 'serve',
    configureServer(server) {
      const dir = path.resolve(server.config.root, opts.dir ?? 'packs');
      const loader = path.resolve(server.config.root, opts.loader ?? 'src/packs/loader.ts');
      server.watcher.add(dir);
      const onChange = (file: string) => {
        const full = path.resolve(file);
        if (path.dirname(full) !== dir || !full.endsWith('.pack.ts') || path.basename(full).startsWith('_')) return;
        const mods = server.moduleGraph.getModulesByFile(loader.replace(/\\/g, '/')) ?? server.moduleGraph.getModulesByFile(loader);
        for (const mod of mods ?? []) void server.reloadModule(mod);
      };
      server.watcher.on('add', onChange);
      server.watcher.on('unlink', onChange);
    },
  };
}

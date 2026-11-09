// Minimal Vite config for running repo scripts that import app modules (`vite-node`): just the `@` alias, none of
// the dev-server plugins.
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, '../src') } },
});

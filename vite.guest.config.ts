import { defineConfig } from 'vite';
import path from 'node:path';

// Builds the standalone, dependency-free guest walkthrough runtime as a single
// IIFE script. The main app inlines this script into exported guest HTML files
// so recipients can open them without Neest, an account, or network access.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'src/generated',
    emptyOutDir: true,
    copyPublicDir: false,
    reportCompressedSize: false,
    lib: {
      entry: path.resolve(__dirname, 'src/guest-viewer/main.ts'),
      name: 'NeestGuestViewer',
      formats: ['iife'],
      fileName: () => 'guest-viewer.js',
    },
  },
});

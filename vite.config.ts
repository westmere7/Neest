/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { neestWorkspace } from './tools/neest-workspace-plugin';

// Main application build. The guest viewer runtime is built first by
// vite.guest.config.ts into src/generated/ and inlined into guest exports.
export default defineConfig({
  plugins: [
    react(),
    // Mirrors projects into <repo>/projects and pushes on-disk changes to open browsers (dev/preview only).
    // NEEST_WORKSPACE=off disables it (e2e runs must not write test projects into the shared folder).
    ...(process.env.NEEST_WORKSPACE === 'off' ? [] : [neestWorkspace({ dir: 'projects' })]),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Neest — Apartment Planner',
        short_name: 'Neest',
        description: 'Local-first 2D/3D apartment floor planner',
        theme_color: '#143c37',
        background_color: '#1d1f22',
        display: 'standalone',
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    watch: {
      // Project JSON is synced by the workspace plugin; it must not trigger page reloads.
      ignored: ['**/projects/**/*.tmp'],
    },
  },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f: ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});

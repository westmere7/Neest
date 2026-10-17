/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { neestWorkspace } from './tools/neest-workspace-plugin';
import { neestPacks } from './tools/neest-packs-plugin';

// Main application build. The guest viewer runtime is built first by
// vite.guest.config.ts into src/generated/ and inlined into guest exports.
export default defineConfig({
  plugins: [
    react(),
    // Mirrors projects into <repo>/projects and pushes on-disk changes to open browsers (dev/preview only).
    // NEEST_WORKSPACE=off disables it (e2e runs must not write test projects into the shared folder).
    ...(process.env.NEEST_WORKSPACE === 'off' ? [] : [neestWorkspace({ dir: 'projects' })]),
    // Hot-loads content packs added to or removed from /packs (one .pack.ts file each).
    neestPacks(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.png', 'logo.png'],
      manifest: {
        name: 'Neest — Apartment Planner',
        short_name: 'Neest',
        description: 'Local-first 2D/3D apartment floor planner',
        theme_color: '#000000',
        background_color: '#1d1f22',
        display: 'standalone',
        icons: [
          { src: 'favicon.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Photo textures (public/textures, ~23 MB) are not precached; they are cached on first use.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/textures/manifest.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'neest-texture-manifest' },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/textures/') && url.pathname.endsWith('.webp'),
            handler: 'CacheFirst',
            options: { cacheName: 'neest-textures', expiration: { maxEntries: 200 } },
          },
          // Pre-generated library thumbnails (public/thumbs): cached as cards scroll into view.
          {
            urlPattern: ({ url }) => url.pathname.endsWith('/thumbs/manifest.json'),
            handler: 'NetworkFirst',
            options: { cacheName: 'neest-thumb-manifest' },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/thumbs/') && url.pathname.endsWith('.webp'),
            handler: 'CacheFirst',
            options: { cacheName: 'neest-thumbs', expiration: { maxEntries: 1500 } },
          },
        ],
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
  esbuild: {
    // The lazily loaded thumbnail renderer awaits its photo textures at module level.
    supported: { 'top-level-await': true },
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

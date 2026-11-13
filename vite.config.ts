/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages project site: https://<user>.github.io/nameplate-forge/
  base: '/nameplate-forge/',
  plugins: [react()],
  worker: {
    // The geometry worker is an ES module worker (imports manifold-3d + opentype.js).
    format: 'es',
  },
  optimizeDeps: {
    // manifold-3d locates its .wasm via import.meta.url; we pass an explicit
    // locateFile, but keep it out of dep pre-bundling so dev and build behave the same.
    exclude: ['manifold-3d'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
  },
});

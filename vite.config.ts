import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Relative base so the site works from any GitHub Pages path (user or project site).
export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        scores: resolve(__dirname, 'scores.html'),
        archive: resolve(__dirname, 'archive.html'),
        how: resolve(__dirname, 'how.html'),
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});

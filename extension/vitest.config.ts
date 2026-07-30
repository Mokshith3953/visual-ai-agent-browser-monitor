import { defineConfig } from 'vitest/config';

// Separate from vite.config.ts (which wires the @crxjs/vite-plugin manifest
// build) — unit tests only need plain TS/ESM resolution, not the extension
// packaging pipeline.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

import { defineConfig } from 'vitest/config';

// Vite requires a default configuration export; source modules use named exports.
export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'cornrow' },
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

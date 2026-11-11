import { defineConfig } from 'vitest/config';

// Vite requires a default configuration export; source modules use named exports.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

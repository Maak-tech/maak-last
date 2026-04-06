import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run each test file in its own isolated worker so module-level env mutations
    // (JWT_SECRET, DB_ENCRYPTION_KEY) don't bleed between test suites.
    pool: 'forks',
    include: ['src/__tests__/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/middleware/**', 'src/routes/**'],
      exclude: ['src/__tests__/**', 'src/seed.ts', 'src/migrate.ts'],
    },
  },
})

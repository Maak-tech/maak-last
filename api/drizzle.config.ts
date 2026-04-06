import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  // Points to the schema barrel — drizzle-kit reads all exported tables from here.
  schema: './src/db/schema/index.ts',
  // Migration SQL files are stored here and applied by `bun run src/db/migrate.ts`
  // or `drizzle-kit migrate` (push-based workflow uses `drizzle-kit push` instead).
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // DATABASE_URL must be set in the environment (see .env.example).
    // drizzle-kit reads .env automatically via dotenv in Node, but Bun
    // also loads .env natively, so no explicit dotenv import is needed here.
    url: process.env.DATABASE_URL!,
  },
  // Print the generated SQL for review during development.
  verbose: true,
  // Warn (do not auto-apply) destructive changes like column drops.
  strict: true,
})

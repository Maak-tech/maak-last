/**
 * Database migration runner.
 *
 * Applies all pending SQL migration files from `api/drizzle/` to the
 * target database using the node-postgres driver (not the Neon serverless
 * HTTP driver — migrations need real transaction support).
 *
 * Usage:
 *   bun run src/db/migrate.ts
 *   # or via npm script:
 *   bun run db:migrate
 *
 * The DATABASE_URL environment variable must be set (see api/.env.example).
 * In production, run this as a one-off Railway job before deploying a new
 * API version — never run it in the same process as the API server.
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('[migrate] DATABASE_URL is not set — cannot run migrations.')
  process.exit(1)
}

const isNeon = DATABASE_URL.includes('neon.tech') || DATABASE_URL.includes('sslmode=require')

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: isNeon ? { rejectUnauthorized: true } : false,
  max: 1,               // single connection is sufficient for migrations
  connectionTimeoutMillis: 10_000,
})

const db = drizzle(pool)

const migrationsFolder = path.resolve(__dirname, '../../../drizzle')

console.log('[migrate] Connecting to database...')
console.log(`[migrate] Migrations folder: ${migrationsFolder}`)

try {
  await migrate(db, { migrationsFolder })
  console.log('[migrate] ✓ All migrations applied successfully.')
} catch (err: unknown) {
  console.error('[migrate] ✗ Migration failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
} finally {
  await pool.end()
}

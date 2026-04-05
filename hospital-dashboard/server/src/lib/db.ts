import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('[FATAL] DATABASE_URL environment variable is not set. Set it in .env before starting the server.')
  process.exit(1)
}

export const pool = new Pool({
  connectionString: databaseUrl,
  // rejectUnauthorized must be TRUE in production — Neon uses publicly trusted certs
  // and false would allow MITM attacks on the encrypted connection.
  ssl: databaseUrl.includes('neon.tech') || databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: true } : false,
  // Connection health
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err)
})

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const { rows } = await pool.query(text, params)
  return rows as T[]
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] ?? null
}

/**
 * Run multiple queries inside a single transaction.
 * Automatically rolls back if the callback throws.
 */
export async function withTransaction<T>(
  callback: (txQuery: typeof query) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const txQuery = async <R = Record<string, unknown>>(
      text: string,
      params?: unknown[]
    ): Promise<R[]> => {
      const { rows } = await client.query(text, params)
      return rows as R[]
    }
    const result = await callback(txQuery)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

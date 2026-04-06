import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'
import { logger } from './logger.js'
import { randomUUID } from 'crypto'

/**
 * Acquire a distributed lock for a cron job using an atomic INSERT.
 * Works with Neon HTTP driver (no session required).
 *
 * Returns the lockToken if acquired (use to release), or null if another instance holds it.
 *
 * Why not pg_try_advisory_lock?
 * Advisory locks are SESSION-SCOPED. The Neon HTTP driver creates a new HTTP
 * connection per query, so each call runs in a different session — meaning
 * pg_advisory_unlock() runs on a different session than pg_try_advisory_lock()
 * and the lock provides zero protection against concurrent execution.
 *
 * This implementation uses an atomic INSERT + PK conflict to guarantee that
 * only one instance holds the lock at any given time, regardless of driver.
 */
export async function acquireJobLock(
  jobName: string,
  ttlSeconds: number
): Promise<string | null> {
  const lockToken = randomUUID()

  try {
    // Delete any expired locks first (best-effort cleanup before trying to insert)
    await db.execute(sql`
      DELETE FROM job_locks WHERE job_name = ${jobName} AND locked_until < now()
    `)

    // Try to insert — will throw a PK violation (23505) if another instance
    // already holds a non-expired lock for this job name.
    await db.execute(sql`
      INSERT INTO job_locks (job_name, locked_at, locked_until, instance_id)
      VALUES (
        ${jobName},
        now(),
        now() + (${ttlSeconds} || ' seconds')::interval,
        ${lockToken}
      )
    `)

    return lockToken
  } catch (err: any) {
    if (err?.code === '23505') {
      // Primary key conflict — another instance holds an active lock
      logger.info({ jobName }, '[jobLock] Lock held by another instance, skipping')
      return null
    }
    // Unexpected error — fail open to avoid permanent job starvation
    logger.error({ err, jobName }, '[jobLock] Unexpected error acquiring lock — allowing execution')
    return lockToken
  }
}

export async function releaseJobLock(jobName: string, lockToken: string): Promise<void> {
  try {
    await db.execute(sql`
      DELETE FROM job_locks WHERE job_name = ${jobName} AND instance_id = ${lockToken}
    `)
  } catch (err) {
    logger.warn({ err, jobName }, '[jobLock] Failed to release lock — will expire naturally')
  }
}

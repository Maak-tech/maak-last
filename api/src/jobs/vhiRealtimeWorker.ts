/**
 * VHI Realtime Worker
 *
 * Long-running process that LISTENs on the PostgreSQL `vhi_recompute` channel
 * and triggers an immediate per-user VHI recompute whenever a health write
 * fires pg_notify (vitals, symptoms, or moods POST).
 *
 * This runs alongside the existing 15-minute cron (`vhiCycle.ts`), which
 * continues to handle bulk recomputes. The two are complementary:
 *   - Cron: ensures every user is eventually up-to-date.
 *   - Realtime: makes fresh data visible immediately after a write.
 *
 * Uses a raw `pg` Client (not Neon HTTP) because pg_notify/LISTEN requires a
 * persistent TCP connection that Neon's serverless HTTP driver cannot provide.
 */

import pg from 'pg'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { computeVHIForUser } from './vhiCycle.js'
import { logger } from '../lib/logger.js'

let client: pg.Client | null = null

export async function startVHIRealtimeWorker(): Promise<void> {
  client = new pg.Client({ connectionString: process.env.DATABASE_URL })

  await client.connect()
  await client.query('LISTEN vhi_recompute')

  client.on('notification', async (msg) => {
    if (msg.channel !== 'vhi_recompute') return
    try {
      const payload = JSON.parse(msg.payload ?? '{}') as {
        userId?: string
        triggeredBy?: string
      }
      const { userId, triggeredBy } = payload
      if (!userId) {
        logger.warn({ payload: msg.payload }, '[vhiRealtime] notification missing userId — skipping')
        return
      }
      logger.info({ userId, triggeredBy }, '[vhiRealtime] triggered recompute')
      // Mark the user dirty as a fallback for the 15-min cron in case the
      // realtime recompute fails. The cron will clear the flag on success.
      await db.update(users).set({ vhiDirty: true }).where(eq(users.id, userId))
      await computeVHIForUser(userId)
      logger.info({ userId }, '[vhiRealtime] recompute complete')
    } catch (err) {
      logger.error({ err }, '[vhiRealtime] failed to process notification')
    }
  })

  client.on('error', (err) => {
    logger.error({ err }, '[vhiRealtime] pg client error — worker will restart')
    // Railway will restart the process on exit
    process.exit(1)
  })

  logger.info('[vhiRealtime] listening for vhi_recompute notifications')
}

export async function stopVHIRealtimeWorker(): Promise<void> {
  if (client) {
    await client.end().catch(() => { /* ignore close errors on shutdown */ })
    client = null
  }
}

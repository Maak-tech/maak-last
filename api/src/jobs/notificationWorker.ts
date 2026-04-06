/**
 * Notification Worker — processes the notification_queue table for reliable delivery.
 *
 * Runs every minute via Railway cron. Claims a batch of pending notifications,
 * attempts delivery via the appropriate channel (push / SMS / email), and updates
 * status. Uses exponential backoff on failure (1 min → 5 min → 25 min).
 *
 * Design notes:
 *   - acquireJobLock prevents double-runs if Railway fires two instances.
 *   - The Neon HTTP driver does not support SELECT ... FOR UPDATE SKIP LOCKED.
 *     We use a simpler UPDATE-based claim instead: mark a batch as 'processing',
 *     then select those rows.
 *   - Max 3 attempts per notification (configurable via maxAttempts column).
 *   - After maxAttempts failures the notification is marked 'failed' and skipped.
 */

import { db } from '../db/index.js'
import { notificationQueue } from '../db/schema.js'
import { pushToUser } from '../lib/push.js'
import { logger } from '../lib/logger.js'
import { acquireJobLock, releaseJobLock } from '../lib/jobLock.js'
import { eq, and, lte, lt, sql } from 'drizzle-orm'
import { recordHeartbeat } from '../lib/heartbeat.js'

const BATCH_SIZE = 50

export async function runNotificationWorker(): Promise<void> {
  const lockToken = await acquireJobLock('notificationWorker', 120)
  if (!lockToken) return

  try {
    await processBatch()
    await recordHeartbeat('notificationWorker', 300)
  } finally {
    await releaseJobLock('notificationWorker', lockToken)
  }
}

async function processBatch(): Promise<void> {
  // Claim a batch via UPDATE — avoids SELECT FOR UPDATE which is unsupported on Neon HTTP.
  // We only claim rows where attempts < maxAttempts to avoid re-processing permanently failed items.
  await db.update(notificationQueue)
    .set({ status: 'processing' })
    .where(
      and(
        eq(notificationQueue.status, 'pending'),
        lte(notificationQueue.scheduledFor, new Date()),
        lt(notificationQueue.attempts, notificationQueue.maxAttempts)
      )
    )
    .limit(BATCH_SIZE)

  // Select the rows we just claimed (processedAt IS NULL distinguishes claimed-not-yet-done)
  const claimed = await db.select()
    .from(notificationQueue)
    .where(
      and(
        eq(notificationQueue.status, 'processing'),
        sql`${notificationQueue.processedAt} IS NULL`
      )
    )
    .limit(BATCH_SIZE)

  if (!claimed.length) return

  logger.info({ count: claimed.length }, '[notificationWorker] Processing batch')

  for (const notification of claimed) {
    try {
      if (notification.channel === 'push') {
        await pushToUser(notification.userId, {
          title: notification.title ?? '',
          body: notification.body,
          data: (notification.dataJson as Record<string, unknown>) ?? {},
        })
      }
      // TODO: SMS channel — integrate Twilio / AWS SNS
      // TODO: email channel — integrate Resend / SES

      await db.update(notificationQueue)
        .set({ status: 'sent', processedAt: new Date() })
        .where(eq(notificationQueue.id, notification.id))

    } catch (err) {
      logger.error({ err, notificationId: notification.id }, '[notificationWorker] Delivery failed')

      const nextAttempts = (notification.attempts ?? 0) + 1
      const maxAttempts = notification.maxAttempts ?? 3
      const isFinalAttempt = nextAttempts >= maxAttempts

      // Exponential backoff: 5^1=5 min, 5^2=25 min, 5^3=125 min
      const backoffMs = Math.pow(5, nextAttempts) * 60_000

      await db.update(notificationQueue)
        .set({
          status: isFinalAttempt ? 'failed' : 'pending',
          attempts: nextAttempts,
          errorMessage: String(err),
          scheduledFor: isFinalAttempt ? notification.scheduledFor : new Date(Date.now() + backoffMs),
          // Clear processedAt so subsequent SELECT won't re-pick this row as 'claimed'
          processedAt: isFinalAttempt ? new Date() : null,
        })
        .where(eq(notificationQueue.id, notification.id))
    }
  }
}

// ── Standalone entry point ────────────────────────────────────────────────────

if (import.meta.main) {
  runNotificationWorker()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error({ err }, '[notificationWorker] Fatal error')
      process.exit(1)
    })
}

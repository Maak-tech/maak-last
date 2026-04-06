/**
 * enqueueNotification — inserts a row into notification_queue for async delivery.
 *
 * Using the queue (rather than calling pushToUser directly) gives:
 *   - Idempotency: duplicate idempotencyKey values are silently ignored via
 *     the unique constraint on notification_queue.idempotency_key.
 *   - Retry safety: the notificationWorker job retries failed rows up to
 *     maxAttempts without re-triggering the originating job.
 *   - Decoupling: sending jobs don't block on Expo API latency.
 */

import { db } from '../db/index.js'
import { notificationQueue } from '../db/schema.js'
import { randomUUID, createHash } from 'crypto'
import { logger } from './logger.js'

export interface EnqueueNotificationParams {
  userId: string
  title?: string
  body: string
  data?: Record<string, unknown>
  /**
   * If provided, deduplicates on this key — the same key is silently ignored.
   * If omitted, a deterministic key is derived from userId + body + scheduledFor
   * so that identical enqueue calls for the same event are naturally idempotent.
   */
  idempotencyKey?: string
  channel?: 'push' | 'sms' | 'email'
  scheduledFor?: Date
  maxAttempts?: number
}

export async function enqueueNotification(params: EnqueueNotificationParams): Promise<void> {
  const {
    userId,
    title,
    body,
    data,
    channel = 'push',
    scheduledFor = new Date(),
    maxAttempts = 3,
  } = params

  // Derive a deterministic idempotency key when none is supplied so that
  // duplicate calls for the same notification event are silently collapsed.
  const idempotencyKey = params.idempotencyKey ??
    createHash('sha256')
      .update(`${userId}:${body}:${scheduledFor.toISOString()}`)
      .digest('hex')
      .slice(0, 32)

  try {
    await db.insert(notificationQueue)
      .values({
        id: randomUUID(),
        userId,
        channel,
        title,
        body,
        dataJson: data ?? null,
        idempotencyKey,
        status: 'pending',
        attempts: 0,
        maxAttempts,
        scheduledFor,
      })
      // onConflictDoNothing = idempotent: duplicate idempotencyKey is silently ignored
      .onConflictDoNothing({ target: notificationQueue.idempotencyKey })
  } catch (err) {
    logger.error({ err, userId, idempotencyKey }, '[enqueueNotification] Failed to enqueue notification')
    throw err
  }
}

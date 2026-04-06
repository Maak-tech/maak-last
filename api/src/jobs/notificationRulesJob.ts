import { db } from '../db/index.js'
import { notificationRules, vitals, users } from '../db/schema.js'
import { enqueueNotification } from '../lib/enqueueNotification.js'
import { eq, and, gte, desc, gt } from 'drizzle-orm'
import { logger } from '../lib/logger.js'
import { acquireJobLock, releaseJobLock } from '../lib/jobLock.js'
import { recordHeartbeat } from '../lib/heartbeat.js'

export async function runNotificationRulesJob() {
  const lockToken = await acquireJobLock('notificationRulesJob', 600)
  if (!lockToken) return

  try {
    // Fetch all active rules
    const rules = await db.select()
      .from(notificationRules)
      .where(eq(notificationRules.isActive, true))

    for (const rule of rules) {
      try {
        // Skip if in cooldown
        if (rule.lastTriggeredAt) {
          const cooldownMs = (rule.cooldownMinutes ?? 60) * 60_000
          if (Date.now() - rule.lastTriggeredAt.getTime() < cooldownMs) continue
        }

        // Get the most recent reading for this metric
        const [latest] = await db.select({ value: vitals.value, recordedAt: vitals.recordedAt })
          .from(vitals)
          .where(and(
            eq(vitals.userId, rule.userId),
            eq(vitals.type, rule.metricType),
            gte(vitals.recordedAt, new Date(Date.now() - 24 * 3600_000))  // last 24h
          ))
          .orderBy(desc(vitals.recordedAt))
          .limit(1)

        if (!latest) continue

        const value = parseFloat(String(latest.value))
        let triggered = false

        if (rule.condition === 'above' && value > parseFloat(String(rule.threshold))) triggered = true
        if (rule.condition === 'below' && value < parseFloat(String(rule.threshold))) triggered = true

        if (!triggered) continue

        // Enqueue notification
        const idempotencyKey = `rule:${rule.id}:${latest.recordedAt.toISOString()}`

        if (rule.notifyPatient) {
          await enqueueNotification({
            userId: rule.userId,
            title: `Health Alert`,
            body: `Your ${rule.metricType.replace('_', ' ')} (${value} ${rule.thresholdUnit ?? ''}) is ${rule.condition} the threshold of ${rule.threshold}`,
            data: { screen: 'vitals', ruleId: rule.id },
            idempotencyKey: `${idempotencyKey}:patient`,
          })
        }

        // Update lastTriggeredAt
        await db.update(notificationRules)
          .set({ lastTriggeredAt: new Date() })
          .where(eq(notificationRules.id, rule.id))

      } catch (err) {
        logger.error({ err, ruleId: rule.id }, 'Rule evaluation failed — skipping')
      }
    }

    await recordHeartbeat('notificationRulesJob', 600)
  } finally {
    await releaseJobLock('notificationRulesJob', lockToken)
  }
}

if (import.meta.main) {
  runNotificationRulesJob().catch(console.error)
}

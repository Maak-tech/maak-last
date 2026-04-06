import { db } from '../db/index.js'
import { fallEvents, users, familyMembers } from '../db/schema.js'
import { enqueueNotification } from '../lib/enqueueNotification.js'
import { eq, and, isNull, gte } from 'drizzle-orm'
import { logger } from '../lib/logger.js'
import { acquireJobLock, releaseJobLock } from '../lib/jobLock.js'
import { recordHeartbeat } from '../lib/heartbeat.js'

export async function runFallEventAlertJob() {
  const lockToken = await acquireJobLock('fallEventAlertJob', 300)
  if (!lockToken) return

  try {
    // Find unalerted fall events from the last 10 minutes
    const newFalls = await db.select()
      .from(fallEvents)
      .where(and(
        eq(fallEvents.alertSent, false),
        gte(fallEvents.detectedAt, new Date(Date.now() - 10 * 60_000))
      ))

    for (const fall of newFalls) {
      try {
        // Get patient name and family admins
        const [patient] = await db.select({ name: users.name, familyId: users.familyId })
          .from(users)
          .where(eq(users.id, fall.userId))
          .limit(1)

        // Notify family admins and caregivers
        if (patient?.familyId) {
          const caregivers = await db.select({ userId: familyMembers.userId })
            .from(familyMembers)
            .where(and(
              eq(familyMembers.familyId, patient.familyId),
              eq(familyMembers.role, 'admin')
            ))

          for (const caregiver of caregivers) {
            await enqueueNotification({
              userId: caregiver.userId,
              title: '⚠️ Fall Detected',
              body: 'A family member may have fallen. Please check on them.',
              data: { screen: 'family_dashboard', fallEventId: fall.id },
              idempotencyKey: `fall:${fall.id}:caregiver:${caregiver.userId}`,
            })
          }
        }

        // Mark alert sent
        await db.update(fallEvents)
          .set({ alertSent: true, alertSentAt: new Date() })
          .where(eq(fallEvents.id, fall.id))

      } catch (err) {
        logger.error({ err, fallId: fall.id }, 'Fall alert notification failed')
      }
    }

    await recordHeartbeat('fallEventAlertJob', 600)
  } finally {
    await releaseJobLock('fallEventAlertJob', lockToken)
  }
}

if (import.meta.main) {
  runFallEventAlertJob().catch(console.error)
}

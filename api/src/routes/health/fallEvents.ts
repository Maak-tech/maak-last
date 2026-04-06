import Elysia from 'elysia'
import { db } from '../../db/index.js'
import { fallEvents, users, familyMembers } from '../../db/schema.js'
import { eq, and, desc, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { enqueueNotification } from '../../lib/enqueueNotification.js'
import { logger } from '../../lib/logger.js'

export const fallEventsRoutes = new Elysia()
  .get('/fall-events', async ({ store, query }) => {
    const { userId } = store as { userId: string }
    const { limit = '50' } = query as Record<string, string>

    const events = await db.select()
      .from(fallEvents)
      .where(eq(fallEvents.userId, userId))
      .orderBy(desc(fallEvents.detectedAt))
      .limit(Math.min(parseInt(limit), 200))

    return { events }
  })

  .post('/fall-events', async ({ body, store, set }) => {
    const { userId } = store as { userId: string }
    const b = body as {
      detectedAt: string
      detectionSource?: string
      severity?: string
      locationContext?: string
      injuryReported?: boolean
      consciousnessLost?: boolean
      notes?: string
      accelerometerData?: unknown
    }

    const event = await db.insert(fallEvents)
      .values({
        id: randomUUID(),
        userId,
        detectedAt: new Date(b.detectedAt),
        detectionSource: b.detectionSource ?? 'manual',
        severity: b.severity ?? 'unknown',
        locationContext: b.locationContext ?? 'unknown',
        injuryReported: b.injuryReported ?? false,
        consciousnessLost: b.consciousnessLost ?? false,
        notes: b.notes ?? null,
        accelerometerData: b.accelerometerData ?? null,
        alertSent: false,
      })
      .returning()

    // Alert is sent by the fallEventAlertJob; but for manual/severe falls, alert immediately
    if (b.consciousnessLost || b.severity === 'severe') {
      const [user] = await db.select({ familyId: users.familyId })
        .from(users).where(eq(users.id, userId)).limit(1)

      if (user?.familyId) {
        const admins = await db.select({ userId: familyMembers.userId })
          .from(familyMembers)
          .where(and(eq(familyMembers.familyId, user.familyId), eq(familyMembers.role, 'admin')))

        for (const admin of admins) {
          await enqueueNotification({
            userId: admin.userId,
            title: '🚨 Severe Fall Detected',
            body: 'A family member reported a severe fall. Immediate attention may be needed.',
            data: { screen: 'family_dashboard', fallEventId: event[0].id },
            idempotencyKey: `fall:${event[0].id}:admin:${admin.userId}:immediate`,
          }).catch(err => logger.warn({ err }, 'Fall alert enqueue failed'))
        }

        await db.update(fallEvents)
          .set({ alertSent: true, alertSentAt: new Date() })
          .where(eq(fallEvents.id, event[0].id))
      }
    }

    set.status = 201
    return event[0]
  })

  // PATCH /fall-events/:id/respond — caregiver acknowledges the fall
  .patch('/fall-events/:id/respond', async ({ params, store, set }) => {
    const { userId } = store as { userId: string }

    const updated = await db.update(fallEvents)
      .set({ respondedAt: new Date(), respondedBy: userId })
      .where(and(eq(fallEvents.id, params.id), isNull(fallEvents.respondedAt)))
      .returning()

    if (!updated.length) {
      set.status = 404
      return { error: 'Fall event not found or already responded' }
    }

    return updated[0]
  })

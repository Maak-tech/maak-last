import Elysia from 'elysia'
import { db } from '../../db/index.js'
import { notificationRules } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const notificationRulesRoutes = new Elysia()
  .get('/notification-rules', async ({ store }) => {
    const { userId } = store as { userId: string }
    const rules = await db.select().from(notificationRules)
      .where(eq(notificationRules.userId, userId))
    return { rules }
  })
  .post('/notification-rules', async ({ body, store, set }) => {
    const { userId } = store as { userId: string }
    const b = body as any
    const rule = await db.insert(notificationRules).values({
      id: randomUUID(),
      userId,
      setByUserId: userId,
      metricType: b.metricType,
      condition: b.condition,
      threshold: String(b.threshold),
      thresholdUnit: b.unit ?? null,
      severity: b.severity ?? 'warning',
      notifyPatient: b.notifyPatient ?? true,
      notifyCaregivers: b.notifyCaregivers ?? true,
      notifyEmergencyContacts: b.notifyEmergencyContacts ?? false,
      cooldownMinutes: b.cooldownMinutes ?? 60,
    }).returning()
    set.status = 201
    return rule[0]
  })
  .delete('/notification-rules/:id', async ({ params, store, set }) => {
    const { userId } = store as { userId: string }
    await db.update(notificationRules)
      .set({ isActive: false })
      .where(and(eq(notificationRules.id, params.id), eq(notificationRules.userId, userId)))
    set.status = 204
    return null
  })

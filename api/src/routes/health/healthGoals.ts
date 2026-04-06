import Elysia from 'elysia'
import { db } from '../../db/index.js'
import { healthGoals } from '../../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

export const healthGoalsRoutes = new Elysia()
  .get('/goals', async ({ store }) => {
    const { userId } = store as { userId: string }
    const goals = await db.select().from(healthGoals)
      .where(and(eq(healthGoals.userId, userId), eq(healthGoals.status, 'active')))
    return { goals }
  })
  .post('/goals', async ({ body, store, set }) => {
    const { userId } = store as { userId: string }
    const b = body as any
    const goal = await db.insert(healthGoals).values({
      id: randomUUID(),
      userId,
      metricType: b.metricType,
      goalType: b.goalType,
      targetValue: b.targetValue ?? null,
      targetMin: b.targetMin ?? null,
      targetMax: b.targetMax ?? null,
      unit: b.unit ?? null,
      deadline: b.deadline ? new Date(b.deadline) : null,
      notes: b.notes ?? null,
      setByUserId: userId,
    }).returning()
    set.status = 201
    return goal[0]
  })
  .patch('/goals/:id', async ({ params, body, store, set }) => {
    const { userId } = store as { userId: string }
    const b = body as any
    const updated = await db.update(healthGoals)
      .set({ ...b, updatedAt: new Date() })
      .where(and(eq(healthGoals.id, params.id), eq(healthGoals.userId, userId)))
      .returning()
    if (!updated.length) { set.status = 404; return { error: 'Not found' } }
    return updated[0]
  })
  .delete('/goals/:id', async ({ params, store, set }) => {
    const { userId } = store as { userId: string }
    await db.update(healthGoals)
      .set({ status: 'abandoned', updatedAt: new Date() })
      .where(and(eq(healthGoals.id, params.id), eq(healthGoals.userId, userId)))
    set.status = 204
    return null
  })

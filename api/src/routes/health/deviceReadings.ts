import Elysia, { t } from 'elysia'
import { db } from '../../db/index.js'
import { deviceReadings } from '../../db/schema.js'
import { eq, and, desc, gte, lte } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { logger } from '../../lib/logger.js'

export const deviceReadingsRoutes = new Elysia()
  // GET /device-readings — list device readings for the authenticated user
  .get('/device-readings', async ({ store, query }) => {
    const { userId } = store as { userId: string }
    const { readingType, deviceType, from, to, limit = '100' } = query as Record<string, string>

    const conditions = [eq(deviceReadings.userId, userId)]
    if (readingType) conditions.push(eq(deviceReadings.readingType, readingType))
    if (deviceType) conditions.push(eq(deviceReadings.deviceType, deviceType))
    if (from) conditions.push(gte(deviceReadings.recordedAt, new Date(from)))
    if (to) conditions.push(lte(deviceReadings.recordedAt, new Date(to)))

    const readings = await db.select()
      .from(deviceReadings)
      .where(and(...conditions))
      .orderBy(desc(deviceReadings.recordedAt))
      .limit(Math.min(parseInt(limit), 1000))

    return { readings, count: readings.length }
  })

  // POST /device-readings — ingest new device reading
  .post('/device-readings', async ({ body, store, set }) => {
    const { userId } = store as { userId: string }
    const b = body as {
      deviceId: string
      deviceType: string
      readingType: string
      value?: number
      valueJson?: unknown
      unit?: string
      recordedAt: string
      sourceActivityId?: string
      quality?: string
    }

    const reading = await db.insert(deviceReadings)
      .values({
        id: randomUUID(),
        userId,
        deviceId: b.deviceId,
        deviceType: b.deviceType,
        readingType: b.readingType,
        value: b.value !== undefined ? String(b.value) : null,
        valueJson: b.valueJson ?? null,
        unit: b.unit ?? null,
        recordedAt: new Date(b.recordedAt),
        sourceActivityId: b.sourceActivityId ?? null,
        quality: b.quality ?? null,
      })
      .onConflictDoNothing()  // deduplicate via source_activity_id unique index
      .returning()

    set.status = 201
    return reading[0] ?? { _duplicate: true }
  })

  // POST /device-readings/batch — bulk ingest from wearable sync
  .post('/device-readings/batch', async ({ body, store, set }) => {
    const { userId } = store as { userId: string }
    const { readings } = body as { readings: unknown[] }

    if (!Array.isArray(readings) || readings.length === 0) {
      set.status = 400
      return { error: 'readings must be a non-empty array' }
    }
    if (readings.length > 500) {
      set.status = 400
      return { error: 'Batch size limit is 500 readings' }
    }

    const rows = (readings as any[]).map(r => ({
      id: randomUUID(),
      userId,
      deviceId: r.deviceId,
      deviceType: r.deviceType,
      readingType: r.readingType,
      value: r.value !== undefined ? String(r.value) : null,
      valueJson: r.valueJson ?? null,
      unit: r.unit ?? null,
      recordedAt: new Date(r.recordedAt),
      sourceActivityId: r.sourceActivityId ?? null,
      quality: r.quality ?? null,
    }))

    await db.insert(deviceReadings).values(rows).onConflictDoNothing()

    set.status = 201
    return { inserted: rows.length }
  })

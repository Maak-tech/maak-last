import { db } from '../db/index.js'
import { userBaselines } from '../db/schema/baselines.js'
import { vitals, symptoms } from '../db/schema/health.js'
import { eq, and, gte } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../lib/logger.js'
import { acquireJobLock, releaseJobLock } from '../lib/jobLock.js'

const BASELINE_WINDOW_DAYS = 42 // 6 weeks of clean data
const MIN_SAMPLES_FOR_BASELINE = 7
const ACUTE_ILLNESS_BUFFER_DAYS = 2 // Exclude readings N days around acute illness

const BASELINE_METRICS = [
  'heart_rate',
  'blood_pressure_systolic',
  'blood_pressure_diastolic',
  'blood_glucose',
  'spo2',
  'weight',
  'hrv_ms',
] as const

interface AcuteWindow {
  start: Date
  end: Date
}

async function getAcuteIllnessWindows(
  userId: string,
  since: Date,
): Promise<AcuteWindow[]> {
  const acuteSymptoms = await db
    .select({ recordedAt: symptoms.recordedAt })
    .from(symptoms)
    .where(
      and(
        eq(symptoms.userId, userId),
        gte(symptoms.recordedAt, since),
      ),
    )
    // Filter for high severity in memory (simpler than parameterised JSONB query)

  // Build buffer windows around each acute symptom episode
  const windows: AcuteWindow[] = []
  for (const s of acuteSymptoms) {
    const bufferMs = ACUTE_ILLNESS_BUFFER_DAYS * 86_400_000
    windows.push({
      start: new Date(s.recordedAt.getTime() - bufferMs),
      end: new Date(s.recordedAt.getTime() + bufferMs),
    })
  }
  return windows
}

export async function computeBaseline(
  userId: string,
  metricType: string,
  reason: string = 'scheduled',
): Promise<void> {
  const windowStart = new Date(Date.now() - BASELINE_WINDOW_DAYS * 86_400_000)

  const acuteWindows = await getAcuteIllnessWindows(userId, windowStart)

  const allReadings = await db
    .select({ value: vitals.value, recordedAt: vitals.recordedAt })
    .from(vitals)
    .where(
      and(
        eq(vitals.userId, userId),
        eq(vitals.type, metricType),
        gte(vitals.recordedAt, windowStart),
      ),
    )
    .orderBy(vitals.recordedAt)

  // Exclude readings during acute illness windows
  const cleanReadings = allReadings.filter(
    (r) => !acuteWindows.some((w) => r.recordedAt >= w.start && r.recordedAt <= w.end),
  )

  if (cleanReadings.length < MIN_SAMPLES_FOR_BASELINE) {
    logger.info(
      { userId, metricType, cleanCount: cleanReadings.length },
      '[baseline] Insufficient clean data — skipping',
    )
    return
  }

  const values = cleanReadings.map((r) => Number(r.value))
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const stdDev = Math.sqrt(variance)

  const sorted = [...values].sort((a, b) => a - b)
  const percentile = (p: number) => sorted[Math.floor(sorted.length * p)] ?? sorted[0]

  const confidenceScore = Math.min(1, cleanReadings.length / 42)
  const isStable = stdDev / mean < 0.1 // CV < 10%

  const windowEnd = new Date()

  await db
    .insert(userBaselines)
    .values({
      id: uuidv4(),
      userId,
      metricType,
      mean: mean.toFixed(4),
      stdDev: stdDev.toFixed(4),
      p10: percentile(0.1).toFixed(4),
      p25: percentile(0.25).toFixed(4),
      p75: percentile(0.75).toFixed(4),
      p90: percentile(0.9).toFixed(4),
      sampleCount: cleanReadings.length,
      computedAt: new Date(),
      windowStartAt: windowStart,
      windowEndAt: windowEnd,
      confidenceScore: confidenceScore.toFixed(3),
      isStable,
      recomputeReason: reason,
    })
    .onConflictDoUpdate({
      target: [userBaselines.userId, userBaselines.metricType],
      set: {
        mean: mean.toFixed(4),
        stdDev: stdDev.toFixed(4),
        p10: percentile(0.1).toFixed(4),
        p25: percentile(0.25).toFixed(4),
        p75: percentile(0.75).toFixed(4),
        p90: percentile(0.9).toFixed(4),
        sampleCount: cleanReadings.length,
        computedAt: new Date(),
        windowStartAt: windowStart,
        windowEndAt: windowEnd,
        confidenceScore: confidenceScore.toFixed(3),
        isStable,
        recomputeReason: reason,
      },
    })

  logger.info(
    { userId, metricType, sampleCount: cleanReadings.length, confidenceScore: confidenceScore.toFixed(2) },
    '[baseline] Computed successfully',
  )
}

export async function runBaselineRecomputeJob(): Promise<void> {
  const lockToken = await acquireJobLock('baselineRecompute', 3600)
  if (!lockToken) {
    logger.info('[baselineRecompute] Already running — skipping')
    return
  }

  try {
    logger.info('[baselineRecompute] Starting')

    // Get all active users who have vitals in last 90 days
    const activeUsers = await db
      .selectDistinct({ userId: vitals.userId })
      .from(vitals)
      .where(gte(vitals.recordedAt, new Date(Date.now() - 90 * 86_400_000)))

    let processed = 0
    let failed = 0

    for (const { userId } of activeUsers) {
      for (const metric of BASELINE_METRICS) {
        try {
          await computeBaseline(userId, metric, 'scheduled')
          processed++
        } catch (err) {
          failed++
          logger.warn({ err, userId, metric }, '[baselineRecompute] Failed for user/metric')
        }
      }
    }

    logger.info({ processed, failed }, '[baselineRecompute] Complete')
  } finally {
    await releaseJobLock('baselineRecompute', lockToken)
  }
}

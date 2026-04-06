import { db } from '../db/index.js'
import { users, vitals, symptoms, moods, healthTrends } from '../db/schema.js'
import { eq, and, gte, desc, sql, isNull, or, lt } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { logger } from '../lib/logger.js'
import { acquireJobLock, releaseJobLock } from '../lib/jobLock.js'
import { recordHeartbeat } from '../lib/heartbeat.js'

interface MetricSemantics {
  higherIsBetter: boolean
  clinicalName: string
}

const METRIC_SEMANTICS: Record<string, MetricSemantics> = {
  heart_rate:               { higherIsBetter: false, clinicalName: 'Heart Rate' },
  blood_pressure_systolic:  { higherIsBetter: false, clinicalName: 'Systolic BP' },
  blood_pressure_diastolic: { higherIsBetter: false, clinicalName: 'Diastolic BP' },
  blood_glucose:            { higherIsBetter: false, clinicalName: 'Blood Glucose' },
  weight:                   { higherIsBetter: false, clinicalName: 'Weight' },
  spo2:                     { higherIsBetter: true,  clinicalName: 'SpO₂' },
  steps:                    { higherIsBetter: true,  clinicalName: 'Steps' },
  sleep_hours:              { higherIsBetter: true,  clinicalName: 'Sleep' },
  hrv_ms:                   { higherIsBetter: true,  clinicalName: 'HRV' },
}

function classifyTrend(
  slope: number,
  metricType: string,
): { rawDirection: 'increasing' | 'decreasing' | 'stable'; clinicalDirection: 'improving' | 'worsening' | 'stable' } {
  if (Math.abs(slope) < 0.05) {
    return { rawDirection: 'stable', clinicalDirection: 'stable' }
  }
  const rawDirection = slope > 0 ? 'increasing' : 'decreasing'
  const semantics = METRIC_SEMANTICS[metricType]
  if (!semantics) {
    // Unknown metric — use raw direction, mark clinical as ambiguous (map to 'stable' as safe default)
    return { rawDirection, clinicalDirection: 'stable' }
  }
  const isMovingUp = slope > 0
  const clinicalDirection = isMovingUp === semantics.higherIsBetter ? 'improving' : 'worsening'
  return { rawDirection, clinicalDirection }
}

const METRIC_CONFIGS = [
  { type: 'heart_rate', table: 'vitals', valueCol: 'value', filterType: 'heart_rate' },
  { type: 'blood_pressure_systolic', table: 'vitals', valueCol: 'value', filterType: 'blood_pressure_systolic' },
  { type: 'blood_pressure_diastolic', table: 'vitals', valueCol: 'value', filterType: 'blood_pressure_diastolic' },
  { type: 'weight', table: 'vitals', valueCol: 'value', filterType: 'weight' },
  { type: 'blood_glucose', table: 'vitals', valueCol: 'value', filterType: 'blood_glucose' },
  { type: 'spo2', table: 'vitals', valueCol: 'value', filterType: 'spo2' },
] as const

const PERIOD_CONFIGS = [
  { type: 'weekly', days: 7 },
  { type: 'monthly', days: 30 },
  { type: '90day', days: 90 },
] as const

async function computeTrendsForUser(userId: string): Promise<void> {
  for (const metric of METRIC_CONFIGS) {
    for (const period of PERIOD_CONFIGS) {
      const periodStart = new Date(Date.now() - period.days * 86_400_000)
      const periodEnd = new Date()

      try {
        // Fetch raw data for this metric+period
        const readings = await db.select({
          value: vitals.value,
          recordedAt: vitals.recordedAt
        })
        .from(vitals)
        .where(and(
          eq(vitals.userId, userId),
          eq(vitals.type, metric.filterType),
          gte(vitals.recordedAt, periodStart)
        ))
        .orderBy(vitals.recordedAt)

        if (readings.length < 3) continue  // need at least 3 points for a trend

        const values = readings.map(r => parseFloat(String(r.value)))
        const avg = values.reduce((a, b) => a + b, 0) / values.length
        const min = Math.min(...values)
        const max = Math.max(...values)
        const stdDev = Math.sqrt(values.map(v => (v - avg) ** 2).reduce((a, b) => a + b, 0) / values.length)

        // Simple linear regression for trend slope
        const n = values.length
        const xMean = (n - 1) / 2
        const slope = values.reduce((acc, v, i) => acc + (i - xMean) * (v - avg), 0) /
                      values.reduce((acc, _, i) => acc + (i - xMean) ** 2, 0)

        const { rawDirection, clinicalDirection } = classifyTrend(slope, metric.type)

        await db.insert(healthTrends)
          .values({
            id: randomUUID(),
            userId,
            metricType: metric.type,
            periodType: period.type,
            periodStart,
            periodEnd,
            avgValue: String(avg.toFixed(4)),
            minValue: String(min),
            maxValue: String(max),
            stdDev: String(stdDev.toFixed(4)),
            sampleCount: n,
            trend: rawDirection,
            clinicalDirection,
            trendSlope: String(slope.toFixed(6)),
            trendConfidence: String(Math.min(1, n / 30).toFixed(2)),
            computedAt: new Date(),
            validUntil: new Date(Date.now() + 6 * 3600_000),  // valid for 6 hours
          })
          .onConflictDoUpdate({
            target: [healthTrends.userId, healthTrends.metricType, healthTrends.periodType, healthTrends.periodStart],
            set: {
              avgValue: sql`excluded.avg_value`,
              minValue: sql`excluded.min_value`,
              maxValue: sql`excluded.max_value`,
              stdDev: sql`excluded.std_dev`,
              sampleCount: sql`excluded.sample_count`,
              trend: sql`excluded.trend`,
              clinicalDirection: sql`excluded.clinical_direction`,
              trendSlope: sql`excluded.trend_slope`,
              trendConfidence: sql`excluded.trend_confidence`,
              computedAt: sql`excluded.computed_at`,
              validUntil: sql`excluded.valid_until`,
            }
          })
      } catch (err) {
        logger.warn({ err, userId, metric: metric.type, period: period.type }, 'Trend computation failed for metric — skipping')
      }
    }
  }
}

export async function runTrendCalculationJob() {
  const lockToken = await acquireJobLock('trendCalculationJob', 3600)
  if (!lockToken) return

  try {
    logger.info('[trendCalc] Starting trend calculation')

    // Only process users with recent health data (vitals in last 90 days)
    const activeUsers = await db.selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(vitals, and(
        eq(vitals.userId, users.id),
        gte(vitals.recordedAt, new Date(Date.now() - 90 * 86_400_000))
      ))

    logger.info({ count: activeUsers.length }, '[trendCalc] Processing users')

    let processed = 0
    let failed = 0

    for (const user of activeUsers) {
      try {
        await computeTrendsForUser(user.id)
        processed++
      } catch (err) {
        logger.error({ err, userId: user.id }, '[trendCalc] User trend computation failed')
        failed++
      }
    }

    logger.info({ processed, failed }, '[trendCalc] Complete')
    await recordHeartbeat('trendCalculationJob', 7200)
  } finally {
    await releaseJobLock('trendCalculationJob', lockToken)
  }
}

if (import.meta.main) {
  runTrendCalculationJob().catch(console.error)
}

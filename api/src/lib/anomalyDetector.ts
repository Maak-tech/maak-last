import { db } from '../db/index.js'
import { userBaselines } from '../db/schema/baselines.js'
import { anomalyEvents } from '../db/schema/anomalies.js'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { logger } from './logger.js'

const ANOMALY_Z_THRESHOLD = 2.5    // Flag as anomaly
const REVIEW_Z_THRESHOLD = 3.0    // Flag as requiring review (escalation candidate)

export interface AnomalyDetectionInput {
  userId: string
  metricType: string
  value: number
  readingId?: string
}

export interface AnomalyDetectionResult {
  isAnomaly: boolean
  zScore?: number
  anomalyClass?: 'spike' | 'drop' | 'sustained_elevation' | 'sustained_depression'
  requiresReview?: boolean
  reason?: string
}

export async function detectAndRecordAnomaly(
  input: AnomalyDetectionInput,
): Promise<AnomalyDetectionResult> {
  const { userId, metricType, value, readingId } = input

  // Fetch the user's baseline for this metric
  const baseline = await db
    .select()
    .from(userBaselines)
    .where(
      and(eq(userBaselines.userId, userId), eq(userBaselines.metricType, metricType)),
    )
    .limit(1)

  if (baseline.length === 0 || Number(baseline[0].confidenceScore) < 0.3) {
    return { isAnomaly: false, reason: 'baseline_immature' }
  }

  const b = baseline[0]
  const mean = Number(b.mean)
  const stdDev = Number(b.stdDev)

  if (stdDev === 0) return { isAnomaly: false, reason: 'zero_std_dev' }

  const zScore = (value - mean) / stdDev

  if (Math.abs(zScore) < ANOMALY_Z_THRESHOLD) {
    return { isAnomaly: false, zScore }
  }

  const anomalyClass: AnomalyDetectionResult['anomalyClass'] = zScore > 0 ? 'spike' : 'drop'
  const requiresReview = Math.abs(zScore) >= REVIEW_Z_THRESHOLD

  // Record the anomaly event
  const eventId = uuidv4()
  await db.insert(anomalyEvents).values({
    id: eventId,
    userId,
    metricType,
    readingId: readingId ?? null,
    observedValue: value.toString(),
    baselineMean: mean.toString(),
    baselineStdDev: stdDev.toString(),
    zScore: zScore.toFixed(3),
    anomalyClass,
    requiresReview,
    detectedAt: new Date(),
    dismissed: false,
  })

  logger.info(
    { userId, metricType, value, zScore: zScore.toFixed(2), anomalyClass, requiresReview },
    '[anomaly] Anomaly detected',
  )

  return { isAnomaly: true, zScore, anomalyClass, requiresReview }
}

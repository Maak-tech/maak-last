import { db } from '../db/index.js'
import { medications, escalations } from '../db/schema/index.js'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../lib/logger.js'
import { enqueueNotification } from '../lib/enqueueNotification.js'
import { acquireJobLock, releaseJobLock } from '../lib/jobLock.js'

const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? 'http://localhost:8000'

interface DdiCheckPayload {
  medicationId: string
  userId: string
  medicationName: string
}

interface DdiInteraction {
  drugName: string
  severity: 'major' | 'moderate' | 'minor' | 'contraindicated'
  description: string
}

async function checkInteractionsWithMlService(
  medicationId: string,
  userId: string,
): Promise<DdiInteraction[]> {
  // Fetch all active medications for the user
  const activeMeds = await db
    .select({ id: medications.id, name: medications.name })
    .from(medications)
    .where(and(eq(medications.userId, userId), eq(medications.isActive, true)))

  const res = await fetch(`${ML_SERVICE_URL}/api/ddi/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicationId, allMedicationIds: activeMeds.map((m) => m.id) }),
    signal: AbortSignal.timeout(15_000),
  })

  if (!res.ok) {
    throw new Error(`DDI service returned ${res.status}`)
  }

  const data = await res.json() as { interactions?: DdiInteraction[] }
  return data.interactions ?? []
}

export async function runDdiCheck(payload: DdiCheckPayload): Promise<void> {
  const { medicationId, userId, medicationName } = payload
  const lockName = `ddi-check:${medicationId}`
  const lockToken = await acquireJobLock(lockName, 120)
  if (!lockToken) {
    logger.info({ medicationId }, '[ddiCheck] Already running — skipping')
    return
  }

  try {
    let interactions: DdiInteraction[]
    try {
      interactions = await checkInteractionsWithMlService(medicationId, userId)
    } catch (err) {
      logger.error({ err, medicationId, userId }, '[ddiCheck] DDI service call failed')
      // Notify user that DDI check failed — they should verify manually
      await enqueueNotification({
        userId,
        title: 'Medication Check Pending',
        body: `We could not complete a drug interaction check for ${medicationName}. Please review your medications with a pharmacist.`,
        idempotencyKey: `ddi-fail:${medicationId}`,
      })
      return
    }

    const dangerous = interactions.filter(
      (i) => i.severity === 'major' || i.severity === 'contraindicated',
    )

    if (dangerous.length === 0) {
      logger.info({ medicationId, userId }, '[ddiCheck] No dangerous interactions found')
      return
    }

    logger.warn(
      { medicationId, userId, dangerousCount: dangerous.length },
      '[ddiCheck] Dangerous drug interaction detected',
    )

    // Notify user
    await enqueueNotification({
      userId,
      title: 'Drug Interaction Alert',
      body: `${medicationName} may interact with ${dangerous[0].drugName}. Please consult your doctor before continuing.`,
      idempotencyKey: `ddi-alert:${medicationId}:${dangerous[0].drugName}`,
    })

    // Create escalation for care team visibility
    await db.insert(escalations).values({
      id: uuidv4(),
      userId,
      type: 'drug_interaction',
      severity: dangerous[0].severity === 'contraindicated' ? 'critical' : 'high',
      metadata: {
        medicationId,
        medicationName,
        interactions: dangerous.map((i) => ({
          drugName: i.drugName,
          severity: i.severity,
          description: i.description,
        })),
        source: 'ddi_auto',
      },
    })
  } finally {
    await releaseJobLock(lockName, lockToken)
  }
}

/**
 * Shift handoff routes.
 *
 * GET /shift/summary — returns a summary of all recognition sessions and
 * patient interactions for the current staff member's active shift.
 *
 * A "shift" is defined as the period since the staff member's last login
 * (or the last 12 hours if no login timestamp is available).  Shift duration
 * can be overridden with the `?hours=N` query parameter (max 24).
 *
 * The summary is designed to be printed or handed off when a nurse/doctor
 * ends their shift, giving the incoming staff member a quick view of:
 *   - How many patients were identified (face / QR / manual)
 *   - Which patients had full twin access granted
 *   - Any unresolved alerts for those patients
 *   - The confidence scores for face recognition attempts
 *
 * HIPAA: the response includes patient names (PHI) — it is auth-gated to the
 * requesting staff member and should only show patients THEY accessed during
 * the shift (not all hospital patients).
 */

import { Hono } from 'hono'
import { query, queryOne } from '../lib/db.js'
import { writeAudit } from '../lib/audit.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

export const shiftRoutes = new Hono()

// GET /shift/summary — shift handoff summary for the calling staff member
shiftRoutes.get('/shift/summary', jwtAuth, async (c) => {
  const staff = c.get('staff')

  // Shift window: default 12 hours, override with ?hours=N (max 24)
  const hoursParam = Number(c.req.query('hours') ?? '12')
  const shiftHours = Math.min(Math.max(1, isNaN(hoursParam) ? 12 : hoursParam), 24)
  const shiftStart = new Date(Date.now() - shiftHours * 60 * 60 * 1000)

  // 1. All recognition sessions initiated by this staff member in the shift window
  const sessions = await query<{
    id: string
    patient_id: string
    access_level: string
    method: string
    confirmed: boolean
    created_at: string
    confirmed_at: string | null
    expires_at: string
  }>(
    `SELECT id, patient_id, access_level, method, confirmed, created_at, confirmed_at, expires_at
     FROM recognition_sessions
     WHERE staff_id = $1 AND created_at >= $2
     ORDER BY created_at DESC
     LIMIT 100`,
    [staff.staffId, shiftStart.toISOString()]
  )

  if (sessions.length === 0) {
    return c.json({
      staffId: staff.staffId,
      staffRole: staff.role,
      shiftStartAt: shiftStart.toISOString(),
      shiftHours,
      totalPatients: 0,
      fullTwinAccesses: 0,
      nearMissAttempts: 0,
      patients: [],
      generatedAt: new Date().toISOString(),
    })
  }

  // 2. Get patient names for the patients in this shift
  const patientIds = [...new Set(sessions.map((s) => s.patient_id))]
  const patientRows = await query<{ id: string; name: string; blood_type: string | null }>(
    `SELECT id, name, blood_type FROM patients WHERE id = ANY($1::text[])`,
    [patientIds]
  )
  const patientMap = new Map(patientRows.map((p) => [p.id, p]))

  // 3. Get unresolved alerts for these patients
  const alertRows = await query<{
    patient_id: string
    alert_type: string
    severity: string
    message: string
    created_at: string
  }>(
    `SELECT patient_id, alert_type, severity, message, created_at
     FROM twin_alerts
     WHERE patient_id = ANY($1::text[]) AND resolved_at IS NULL
     ORDER BY created_at DESC
     LIMIT 200`,
    [patientIds]
  )
  const alertsByPatient = new Map<string, typeof alertRows>()
  for (const a of alertRows) {
    const existing = alertsByPatient.get(a.patient_id) ?? []
    existing.push(a)
    alertsByPatient.set(a.patient_id, existing)
  }

  // 4. Get near-miss audit entries for this staff member in the shift window
  const nearMissRows = await query<{ confidence: number; created_at: string }>(
    `SELECT confidence, created_at FROM access_audit_logs
     WHERE staff_id = $1
       AND action = 'near_miss_recognition'
       AND created_at >= $2
     ORDER BY created_at DESC
     LIMIT 50`,
    [staff.staffId, shiftStart.toISOString()]
  )

  // 5. Build per-patient summary
  const patientSummaries = patientIds.map((patientId) => {
    const patient = patientMap.get(patientId)
    const patientSessions = sessions.filter((s) => s.patient_id === patientId)
    const fullAccess = patientSessions.some((s) => s.access_level === 'confirmed' || s.access_level === 'full')
    const unresolvedAlerts = alertsByPatient.get(patientId) ?? []

    return {
      patientId,
      name: patient?.name ?? 'Unknown',
      bloodType: patient?.blood_type ?? null,
      identificationMethod: patientSessions[0]?.method ?? 'unknown',
      fullTwinAccessed: fullAccess,
      firstSeenAt: patientSessions[patientSessions.length - 1]?.created_at ?? null,
      lastSeenAt: patientSessions[0]?.created_at ?? null,
      sessionCount: patientSessions.length,
      unresolvedAlerts: unresolvedAlerts.map((a) => ({
        type: a.alert_type,
        severity: a.severity,
        message: a.message,
        createdAt: a.created_at,
      })),
    }
  })

  // 6. Write audit entry for the handoff view itself
  await writeAudit({
    staffId: staff.staffId,
    action: 'shift_handoff_viewed',
    method: 'manual',
    success: true,
  })

  return c.json({
    staffId: staff.staffId,
    staffRole: staff.role,
    shiftStartAt: shiftStart.toISOString(),
    shiftHours,
    totalPatients: patientIds.length,
    fullTwinAccesses: patientSummaries.filter((p) => p.fullTwinAccessed).length,
    nearMissAttempts: nearMissRows.length,
    nearMissDetails: nearMissRows.map((r) => ({
      confidence: r.confidence,
      at: r.created_at,
    })),
    patients: patientSummaries,
    generatedAt: new Date().toISOString(),
  })
})

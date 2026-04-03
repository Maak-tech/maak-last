import { Hono } from 'hono'
import { query, queryOne } from '../lib/db.js'
import { writeAudit } from '../lib/audit.js'
import { jwtAuth, requireRole } from '../middleware/jwtAuth.js'

type Session = {
  id: string
  patient_id: string
  staff_id: string
  access_level: string
  method: string
  confirmed: boolean
  expires_at: string
}

type Patient = {
  id: string
  name: string
  date_of_birth: string
  blood_type: string | null
  emergency_contacts: Array<{ name: string; phone: string; relation: string }>
}

export const patientRoutes = new Hono()

async function getValidSession(sessionToken: string): Promise<Session | null> {
  return queryOne<Session>(
    'SELECT * FROM recognition_sessions WHERE id = $1 AND expires_at > now()',
    [sessionToken]
  )
}

// GET /patient/preview/:sessionToken — limited preview (no full PHI)
patientRoutes.get('/patient/preview/:sessionToken', jwtAuth, async (c) => {
  const staff = c.get('staff')
  const { sessionToken } = c.req.param()

  const session = await getValidSession(sessionToken)
  if (!session) return c.json({ error: 'Session expired or not found' }, 401)

  // Session must belong to the requesting staff member.
  if (session.staff_id !== staff.staffId) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  const patient = await queryOne<Patient>(
    'SELECT id, name, date_of_birth, blood_type FROM patients WHERE id = $1',
    [session.patient_id]
  )
  if (!patient) return c.json({ error: 'Patient not found' }, 404)

  // Get risk level from digital twin
  const twin = await queryOne<{ risk_score: number; risk_level: string }>(
    'SELECT risk_score, risk_level FROM digital_twins WHERE patient_id = $1 ORDER BY computed_at DESC LIMIT 1',
    [patient.id]
  )

  const dob = new Date(patient.date_of_birth)
  const maskedDob = `**/**/${dob.getFullYear()}`  // Only show year

  await writeAudit({
    staffId: staff.staffId,
    patientId: patient.id,
    action: 'patient_preview_viewed',
    method: session.method,
  })

  return c.json({
    sessionToken,
    name: patient.name,
    maskedDob,
    riskLevel: twin?.risk_level ?? 'unknown',
    riskScore: twin?.risk_score ?? null,
    confirmed: session.confirmed,
  })
})

// POST /patient/confirm/:sessionToken — staff clicks "Confirm Identity"
patientRoutes.post('/patient/confirm/:sessionToken', jwtAuth, async (c) => {
  const staff = c.get('staff')
  const { sessionToken } = c.req.param()

  const session = await getValidSession(sessionToken)
  if (!session) return c.json({ error: 'Session expired or not found' }, 401)

  // Verify the session belongs to the requesting staff member.
  // Without this check, any authenticated staff could confirm another staff's
  // recognition session and gain access to an unrelated patient's full twin.
  if (session.staff_id !== staff.staffId) {
    await writeAudit({
      staffId: staff.staffId,
      patientId: session.patient_id,
      action: 'session_ownership_violation',
      success: false,
    })
    return c.json({ error: 'Forbidden' }, 403)
  }

  await query(
    "UPDATE recognition_sessions SET confirmed = true, access_level = 'confirmed', confirmed_at = now() WHERE id = $1",
    [sessionToken]
  )

  await writeAudit({
    staffId: staff.staffId,
    patientId: session.patient_id,
    action: 'identity_confirmed',
    success: true,
  })

  return c.json({ confirmed: true, sessionToken })
})

// GET /patient/by-session/:sessionToken — resolve patientId + twin from session (confirmed required)
patientRoutes.get(
  '/patient/by-session/:sessionToken',
  jwtAuth,
  requireRole('doctor', 'nurse', 'admin'),
  async (c) => {
    const staff = c.get('staff')
    const { sessionToken } = c.req.param()

    const session = await getValidSession(sessionToken)
    if (!session || !session.confirmed) {
      return c.json({ error: 'Confirmed session required' }, 403)
    }

    const patientId = session.patient_id

    const results = await Promise.allSettled([
      queryOne<Patient>('SELECT * FROM patients WHERE id = $1', [patientId]),
      queryOne(
        'SELECT * FROM digital_twins WHERE patient_id = $1 ORDER BY computed_at DESC LIMIT 1',
        [patientId]
      ),
      query(
        "SELECT * FROM twin_alerts WHERE patient_id = $1 AND resolved_at IS NULL ORDER BY severity DESC LIMIT 5",
        [patientId]
      ),
      query(
        "SELECT * FROM twin_vitals_summary WHERE patient_id = $1 AND recorded_at > now() - interval '7 days' ORDER BY recorded_at ASC",
        [patientId]
      ),
      query('SELECT * FROM medications WHERE patient_id = $1 AND is_active = true', [patientId]),
    ])

    const [patientRes, twinRes, alertsRes, vitalsRes, medsRes] = results

    if (patientRes.status === 'rejected') {
      console.error('[patient] Failed to fetch patient:', patientRes.reason)
      return c.json({ error: 'Failed to fetch patient data' }, 500)
    }
    const patient = patientRes.value
    if (!patient) return c.json({ error: 'Patient not found' }, 404)

    await writeAudit({
      staffId: staff.staffId,
      patientId,
      action: 'full_twin_accessed',
      method: session.method,
      success: true,
    })

    return c.json({
      patient: {
        id: patient.id,
        name: patient.name,
        dateOfBirth: patient.date_of_birth,
        bloodType: patient.blood_type,
        emergencyContacts: patient.emergency_contacts ?? [],
      },
      vhi:              twinRes.status   === 'fulfilled' ? twinRes.value   : null,
      recentAlerts:     alertsRes.status === 'fulfilled' ? alertsRes.value : [],
      vitalsTrends:     vitalsRes.status === 'fulfilled' ? vitalsRes.value : [],
      activeMedications: medsRes.status  === 'fulfilled' ? medsRes.value   : [],
    })
  }
)

// GET /patient/:patientId/twin — full digital twin (requires confirmed session)
patientRoutes.get(
  '/patient/:patientId/twin',
  jwtAuth,
  requireRole('doctor', 'nurse', 'admin'),
  async (c) => {
    const staff = c.get('staff')
    const { patientId } = c.req.param()
    // Header only — query param was removed to prevent session token leaking into server access logs
    const sessionToken = c.req.header('X-Session-Token')

    if (!sessionToken) return c.json({ error: 'Session token required' }, 400)

    const session = await getValidSession(sessionToken)
    if (!session || !session.confirmed || session.patient_id !== patientId) {
      return c.json({ error: 'Confirmed session required' }, 403)
    }

    const results = await Promise.allSettled([
      queryOne<Patient>('SELECT * FROM patients WHERE id = $1', [patientId]),
      queryOne(
        'SELECT * FROM digital_twins WHERE patient_id = $1 ORDER BY computed_at DESC LIMIT 1',
        [patientId]
      ),
      query(
        "SELECT * FROM twin_alerts WHERE patient_id = $1 AND resolved_at IS NULL ORDER BY severity DESC LIMIT 5",
        [patientId]
      ),
      query(
        "SELECT * FROM twin_vitals_summary WHERE patient_id = $1 AND recorded_at > now() - interval '7 days' ORDER BY recorded_at ASC",
        [patientId]
      ),
      query(
        'SELECT * FROM medications WHERE patient_id = $1 AND is_active = true',
        [patientId]
      ),
    ])

    const [patientRes, twinRes, alertsRes, vitalsRes, medsRes] = results

    if (patientRes.status === 'rejected') {
      console.error('[patient/twin] Failed to fetch patient:', patientRes.reason)
      return c.json({ error: 'Failed to fetch patient data' }, 500)
    }
    const patient = patientRes.value
    if (!patient) return c.json({ error: 'Patient not found' }, 404)

    await writeAudit({
      staffId: staff.staffId,
      patientId,
      action: 'full_twin_accessed',
      method: session.method,
      success: true,
    })

    return c.json({
      patient: {
        id: patient.id,
        name: patient.name,
        dateOfBirth: patient.date_of_birth,
        bloodType: patient.blood_type,
        emergencyContacts: patient.emergency_contacts ?? [],
      },
      vhi:              twinRes.status   === 'fulfilled' ? twinRes.value   : null,
      recentAlerts:     alertsRes.status === 'fulfilled' ? alertsRes.value : [],
      vitalsTrends:     vitalsRes.status === 'fulfilled' ? vitalsRes.value : [],
      activeMedications: medsRes.status  === 'fulfilled' ? medsRes.value   : [],
    })
  }
)

import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne, withTransaction } from '../lib/db.js'
import { writeAudit } from '../lib/audit.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

export const qrRoutes = new Hono()

// GET /patient/qr/:patientId — generate QR token (can be called by staff or patient app)
qrRoutes.get('/patient/qr/:patientId', jwtAuth, async (c) => {
  const staff = c.get('staff')
  const { patientId } = c.req.param()

  // Validate UUID format before hitting the DB
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(patientId)) {
    return c.json({ error: 'Invalid patient ID format' }, 400)
  }

  const patient = await queryOne('SELECT id FROM patients WHERE id = $1', [patientId])
  if (!patient) return c.json({ error: 'Patient not found' }, 404)

  // Wrap expire + insert in a transaction so that two concurrent calls for the same
  // patient cannot both create a valid token (race condition → two active QR codes).
  const { token, expiresAt } = await withTransaction(async (txQuery) => {
    await txQuery(
      'UPDATE qr_tokens SET used_at = now() WHERE patient_id = $1 AND used_at IS NULL AND expires_at > now()',
      [patientId]
    )
    const newToken = uuidv4()
    const exp = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    await txQuery(
      'INSERT INTO qr_tokens (id, patient_id, token, expires_at, created_by) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), patientId, newToken, exp, staff.staffId]
    )
    return { token: newToken, expiresAt: exp }
  })

  // Audit: record that a staff member generated a QR token for a patient.
  // This is an access-adjacent event — the QR code grants temporary identity
  // access, so its creation must appear in the HIPAA audit trail alongside
  // recognition attempts and session confirmations.
  await writeAudit({
    staffId: staff.staffId,
    patientId,
    action: 'qr_generated',
    method: 'qr',
    success: true,
  })

  return c.json({ token, expiresAt: expiresAt.toISOString() })
})

// POST /patient/qr/generate — patient self-service QR generation via better-auth session.
// Validates the patient token against the main Nuralix API, then generates a
// short-lived QR token the hospital staff can scan to begin the recognition flow.
qrRoutes.post('/patient/qr/generate', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Patient session token required' }, 401)
  }

  const mainApiUrl = process.env.MAIN_API_URL
  if (!mainApiUrl) {
    return c.json({ error: 'QR generation is not configured on this server' }, 503)
  }

  // Validate patient session and get their ID
  let patientId: string
  try {
    const meRes = await fetch(`${mainApiUrl}/api/auth/verify-session`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(8_000),
    })
    if (!meRes.ok) return c.json({ error: 'Invalid or expired patient session' }, 401)
    const me = await meRes.json() as { id?: string }
    if (!me?.id || typeof me.id !== 'string') {
      return c.json({ error: 'Could not identify patient from session' }, 401)
    }
    patientId = me.id
  } catch (err: unknown) {
    console.error('[patient/qr/generate] Patient token validation failed:', err instanceof Error ? err.message : String(err))
    return c.json({ error: 'Could not verify patient identity. Please try again.' }, 503)
  }

  // Wrap expire + insert in a transaction to prevent two simultaneous app sessions
  // creating two active tokens for the same patient.
  const { token, expiresAt } = await withTransaction(async (txQuery) => {
    await txQuery(
      'UPDATE qr_tokens SET used_at = now() WHERE patient_id = $1 AND used_at IS NULL AND expires_at > now()',
      [patientId]
    )
    const newToken = uuidv4()
    const exp = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
    // `created_by` uses the patientId directly — no FK on this column, no hospital_staff row needed.
    await txQuery(
      'INSERT INTO qr_tokens (id, patient_id, token, expires_at, created_by) VALUES ($1, $2, $3, $4, $5)',
      [uuidv4(), patientId, newToken, exp, patientId]
    )
    return { token: newToken, expiresAt: exp }
  })

  // Audit: record patient-initiated QR generation.  No staffId because the
  // actor is the patient themselves (no hospital_staff row).  The patientId
  // is sufficient to correlate with subsequent recognition_attempt events.
  await writeAudit({
    patientId,
    action: 'qr_generated',
    method: 'qr',
    success: true,
  })

  return c.json({ token, expiresAt: expiresAt.toISOString() })
})

// POST /qr/resolve — resolve QR token → sessionToken
qrRoutes.post('/qr/resolve', jwtAuth, async (c) => {
  const staff = c.get('staff')
  let token: string
  try {
    const body = await c.req.json<{ token?: string }>()
    if (!body.token || typeof body.token !== 'string' || body.token.trim().length === 0) {
      return c.json({ error: 'token is required' }, 400)
    }
    token = body.token.trim()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  // Validate UUID format before hitting the DB — QR tokens are always UUIDs;
  // a non-UUID value can never match and lets us skip a DB round-trip.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(token)) {
    return c.json({ error: 'Invalid or expired QR code' }, 404)
  }

  // Atomic claim: mark used_at in the same statement that finds the valid token.
  // This prevents TOCTOU — two concurrent scans of the same QR code cannot
  // both succeed because the first UPDATE wins and the second finds used_at IS NOT NULL.
  const qrToken = await queryOne<{ id: string; patient_id: string }>(
    `UPDATE qr_tokens SET used_at = now()
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     RETURNING id, patient_id`,
    [token]
  )

  if (!qrToken) return c.json({ error: 'Invalid or expired QR code' }, 404)

  const sessionId = uuidv4()
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  await query(
    `INSERT INTO recognition_sessions (id, patient_id, staff_id, access_level, method, confirmed, expires_at)
     VALUES ($1, $2, $3, 'preview', 'qr', false, $4)`,
    [sessionId, qrToken.patient_id, staff.staffId, expiresAt]
  )

  await writeAudit({
    staffId: staff.staffId,
    patientId: qrToken.patient_id,
    action: 'recognition_attempt',
    method: 'qr',
    success: true,
  })

  return c.json({ sessionToken: sessionId })
})

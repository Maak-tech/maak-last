import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../lib/db.js'
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

  // Expire any existing QR tokens for this patient
  await query(
    'UPDATE qr_tokens SET used_at = now() WHERE patient_id = $1 AND used_at IS NULL AND expires_at > now()',
    [patientId]
  )

  const token = uuidv4()
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours

  await query(
    'INSERT INTO qr_tokens (id, patient_id, token, expires_at, created_by) VALUES ($1, $2, $3, $4, $5)',
    [uuidv4(), patientId, token, expiresAt, staff.staffId]
  )

  return c.json({ token, expiresAt: expiresAt.toISOString() })
})

// POST /qr/resolve — resolve QR token → sessionToken
qrRoutes.post('/qr/resolve', jwtAuth, async (c) => {
  const staff = c.get('staff')
  const { token } = await c.req.json<{ token: string }>()

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

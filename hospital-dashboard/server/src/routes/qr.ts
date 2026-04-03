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

  const qrToken = await queryOne<{ id: string; patient_id: string }>(
    'SELECT id, patient_id FROM qr_tokens WHERE token = $1 AND used_at IS NULL AND expires_at > now()',
    [token]
  )

  if (!qrToken) return c.json({ error: 'Invalid or expired QR code' }, 404)

  // Mark QR token as used
  await query('UPDATE qr_tokens SET used_at = now() WHERE id = $1', [qrToken.id])

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

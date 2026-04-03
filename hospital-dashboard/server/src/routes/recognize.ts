import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../lib/db.js'
import { writeAudit } from '../lib/audit.js'
import { decrypt } from '../lib/encryption.js'
import { CompreFaceProvider } from '../lib/biometric/CompreFaceProvider.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

const compreface = new CompreFaceProvider()
const SESSION_TTL_MINUTES = 30

export const recognizeRoutes = new Hono()

// POST /recognize — face recognition → sessionToken (NO PHI returned)
recognizeRoutes.post('/recognize', jwtAuth, async (c) => {
  const staff = c.get('staff')
  const ip = c.req.header('x-forwarded-for') ?? 'unknown'
  const formData = await c.req.formData()
  const imageFile = formData.get('image') as File | null

  if (!imageFile) return c.json({ error: 'No image provided' }, 400)

  const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
  const result = await compreface.recognize(imageBuffer)

  if (!result) {
    await writeAudit({
      staffId: staff.staffId,
      action: 'recognition_attempt',
      method: 'face',
      success: false,
      confidence: 0,
      ipAddress: ip,
    })
    return c.json({ matched: false, fallback: 'Use QR code or manual search' }, 404)
  }

  // Find patient from encrypted subject ID
  const enrollments = await query<{ patient_id: string; compreface_subject_id: string }>(
    'SELECT patient_id, compreface_subject_id FROM biometric_enrollments WHERE is_active = true'
  )

  let patientId: string | null = null
  for (const e of enrollments) {
    try {
      if (decrypt(e.compreface_subject_id) === result.subjectId) {
        patientId = e.patient_id
        break
      }
    } catch { /* skip malformed entries */ }
  }

  if (!patientId) {
    await writeAudit({
      staffId: staff.staffId,
      action: 'recognition_attempt',
      method: 'face',
      success: false,
      confidence: result.confidence,
      ipAddress: ip,
    })
    return c.json({ matched: false, fallback: 'Use QR code or manual search' }, 404)
  }

  const sessionId = uuidv4()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000)

  await query(
    `INSERT INTO recognition_sessions (id, patient_id, staff_id, access_level, method, confirmed, expires_at)
     VALUES ($1, $2, $3, 'preview', 'face', false, $4)`,
    [sessionId, patientId, staff.staffId, expiresAt]
  )

  await writeAudit({
    staffId: staff.staffId,
    patientId,
    action: 'recognition_attempt',
    method: 'face',
    success: true,
    confidence: result.confidence,
    ipAddress: ip,
  })

  // Return ONLY the session token — no patient data
  return c.json({ matched: true, sessionToken: sessionId })
})

// POST /recognize/manual — manual lookup by name
recognizeRoutes.post('/recognize/manual', jwtAuth, async (c) => {
  const { name } = await c.req.json<{ name: string }>()

  const patients = await query<{ id: string; name: string }>(
    'SELECT id, name FROM patients WHERE lower(name) LIKE lower($1) LIMIT 5',
    [`%${name}%`]
  )

  if (patients.length === 0) return c.json({ results: [] })

  // Return list of name matches — staff selects one → then call /recognize/select
  return c.json({ results: patients.map(p => ({ id: p.id, name: p.name })) })
})

// POST /recognize/select — select a patient from manual search results
recognizeRoutes.post('/recognize/select', jwtAuth, async (c) => {
  const staff = c.get('staff')
  const { patientId } = await c.req.json<{ patientId: string }>()

  const patient = await queryOne('SELECT id FROM patients WHERE id = $1', [patientId])
  if (!patient) return c.json({ error: 'Patient not found' }, 404)

  const sessionId = uuidv4()
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

  await query(
    `INSERT INTO recognition_sessions (id, patient_id, staff_id, access_level, method, confirmed, expires_at)
     VALUES ($1, $2, $3, 'preview', 'manual', false, $4)`,
    [sessionId, patientId, staff.staffId, expiresAt]
  )

  await writeAudit({
    staffId: staff.staffId,
    patientId,
    action: 'recognition_attempt',
    method: 'manual',
    success: true,
  })

  return c.json({ sessionToken: sessionId })
})

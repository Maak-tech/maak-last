import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../lib/db.js'
import { writeAudit } from '../lib/audit.js'
import { encrypt, decrypt } from '../lib/encryption.js'
import { CompreFaceProvider } from '../lib/biometric/CompreFaceProvider.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

const compreface = new CompreFaceProvider()

export const enrollRoutes = new Hono()

// POST /enroll — enroll a patient's face
enrollRoutes.post('/enroll', jwtAuth, async (c) => {
  const staff = c.get('staff')
  const formData = await c.req.formData()
  const patientId = formData.get('patientId') as string
  const consentGiven = formData.get('consentGiven') === 'true'
  const imageFile = formData.get('image') as File | null

  if (!consentGiven) {
    return c.json({ error: 'Patient consent is required for biometric enrollment' }, 400)
  }
  if (!imageFile || !patientId) {
    return c.json({ error: 'Missing patientId or image' }, 400)
  }

  // Verify patient exists
  const patient = await queryOne('SELECT id FROM patients WHERE id = $1', [patientId])
  if (!patient) return c.json({ error: 'Patient not found' }, 404)

  // Check existing active enrollment
  const existing = await queryOne(
    'SELECT id FROM biometric_enrollments WHERE patient_id = $1 AND is_active = true',
    [patientId]
  )
  if (existing) return c.json({ error: 'Patient already enrolled. Revoke first.' }, 409)

  const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
  const subjectId = uuidv4()

  try {
    await compreface.enroll(subjectId, imageBuffer)
  } catch (err) {
    return c.json({ error: 'Face enrollment failed', detail: String(err) }, 500)
  }

  const enrollmentId = uuidv4()
  await query(
    `INSERT INTO biometric_enrollments (id, patient_id, compreface_subject_id, enrolled_by, is_active, enrolled_at)
     VALUES ($1, $2, $3, $4, true, now())`,
    [enrollmentId, patientId, encrypt(subjectId), staff.staffId]
  )

  // Store consent record
  await query(
    `INSERT INTO consents (id, patient_id, consent_type, given, given_at, given_by)
     VALUES ($1, $2, 'biometric', true, now(), $3)`,
    [uuidv4(), patientId, staff.staffId]
  )

  await writeAudit({ staffId: staff.staffId, patientId, action: 'enrollment', success: true })

  return c.json({ enrolled: true, enrollmentId })
})

// DELETE /enroll/:patientId — revoke enrollment
enrollRoutes.delete('/enroll/:patientId', jwtAuth, async (c) => {
  const staff = c.get('staff')
  const { patientId } = c.req.param()

  const enrollment = await queryOne<{ id: string; compreface_subject_id: string }>(
    'SELECT id, compreface_subject_id FROM biometric_enrollments WHERE patient_id = $1 AND is_active = true',
    [patientId]
  )

  if (!enrollment) return c.json({ error: 'No active enrollment found' }, 404)

  const subjectId = decrypt(enrollment.compreface_subject_id)

  await compreface.deleteSubject(subjectId)

  await query(
    'UPDATE biometric_enrollments SET is_active = false, deactivated_at = now() WHERE id = $1',
    [enrollment.id]
  )

  await writeAudit({ staffId: staff.staffId, patientId, action: 'revocation', success: true })

  return c.json({ revoked: true })
})

// GET /enroll/:patientId/status
enrollRoutes.get('/enroll/:patientId/status', jwtAuth, async (c) => {
  const { patientId } = c.req.param()
  const enrollment = await queryOne<{ enrolled_at: string }>(
    'SELECT enrolled_at FROM biometric_enrollments WHERE patient_id = $1 AND is_active = true',
    [patientId]
  )
  return c.json({ enrolled: !!enrollment, enrolledAt: enrollment?.enrolled_at ?? null })
})

import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne, withTransaction } from '../lib/db.js'
import { writeAudit } from '../lib/audit.js'
import { encrypt, decrypt, hmac } from '../lib/encryption.js'
import { CompreFaceProvider } from '../lib/biometric/CompreFaceProvider.js'
import { jwtAuth, requireRole } from '../middleware/jwtAuth.js'

const compreface = new CompreFaceProvider()

export const enrollRoutes = new Hono()

// POST /enroll — enroll a patient's face (doctor/nurse/admin only)
enrollRoutes.post('/enroll', jwtAuth, requireRole('doctor', 'nurse', 'admin'), async (c) => {
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

  // Validate UUID format to prevent wasted DB round-trips and accidental injection
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(patientId)) {
    return c.json({ error: 'Invalid patient ID format' }, 400)
  }

  // Validate image size (max 5 MB) — same guard as recognize.ts
  if (imageFile.size > 5 * 1024 * 1024) {
    return c.json({ error: 'Image too large. Maximum size is 5 MB.' }, 400)
  }

  // Validate MIME type to reject non-image uploads
  const mime = imageFile.type
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    return c.json({ error: 'Invalid image format. Use JPEG, PNG, or WebP.' }, 400)
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
  if (imageBuffer.length === 0) {
    return c.json({ error: 'Image file is empty' }, 400)
  }
  const subjectId = uuidv4()

  try {
    await compreface.enroll(subjectId, imageBuffer)
  } catch (err: unknown) {
    // Log internally but do NOT surface internal error details to the client —
    // the CompreFace error message may contain the service URL, API key, or
    // other internal infrastructure information.
    console.error('[enroll] CompreFace enroll failed:', err instanceof Error ? err.message : String(err))
    return c.json({ error: 'Face enrollment failed. Please try again or use QR fallback.' }, 500)
  }

  const enrollmentId = uuidv4()
  // Wrap enrollment + consent in a transaction — if consent INSERT fails the
  // enrollment row is rolled back, preventing orphaned enrollments without consent.
  await withTransaction(async (txQuery) => {
    await txQuery(
      `INSERT INTO biometric_enrollments (id, patient_id, compreface_subject_id, subject_id_hmac, enrolled_by, is_active, enrolled_at)
       VALUES ($1, $2, $3, $4, $5, true, now())`,
      [enrollmentId, patientId, encrypt(subjectId), hmac(subjectId), staff.staffId]
    )
    await txQuery(
      `INSERT INTO consents (id, patient_id, consent_type, given, given_at, given_by)
       VALUES ($1, $2, 'biometric', true, now(), $3)`,
      [uuidv4(), patientId, staff.staffId]
    )
  })

  await writeAudit({ staffId: staff.staffId, patientId, action: 'enrollment', success: true })

  return c.json({ enrolled: true, enrollmentId })
})

// DELETE /enroll/:patientId — revoke enrollment (admin/doctor only — more restrictive than enroll)
enrollRoutes.delete('/enroll/:patientId', jwtAuth, requireRole('doctor', 'admin'), async (c) => {
  const staff = c.get('staff')
  const { patientId } = c.req.param()

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(patientId)) {
    return c.json({ error: 'Invalid patient ID format' }, 400)
  }

  const enrollment = await queryOne<{ id: string; compreface_subject_id: string }>(
    'SELECT id, compreface_subject_id FROM biometric_enrollments WHERE patient_id = $1 AND is_active = true',
    [patientId]
  )

  if (!enrollment) return c.json({ error: 'No active enrollment found' }, 404)

  let subjectId: string
  try {
    subjectId = decrypt(enrollment.compreface_subject_id)
  } catch (decryptErr: unknown) {
    console.error('[enroll] Failed to decrypt subject ID during revocation:', decryptErr instanceof Error ? decryptErr.message : String(decryptErr))
    return c.json({ error: 'Enrollment record is corrupted. Contact an administrator.' }, 500)
  }

  // Attempt to delete the face embedding from CompreFace.
  // Even if this fails (CompreFace unreachable, subject already removed, etc.)
  // we MUST still deactivate the DB row — otherwise the patient remains
  // "enrolled" in our system but with a stale/deleted embedding.
  try {
    await compreface.deleteSubject(subjectId)
  } catch (err: unknown) {
    // Log but do not re-throw — revocation of the DB record must proceed.
    // An admin can manually clean up the CompreFace subject later if needed.
    console.error('[enroll] CompreFace deleteSubject failed (DB enrollment will still be deactivated):', err instanceof Error ? err.message : String(err))
  }

  await query(
    'UPDATE biometric_enrollments SET is_active = false, deactivated_at = now() WHERE id = $1',
    [enrollment.id]
  )

  await writeAudit({ staffId: staff.staffId, patientId, action: 'revocation', success: true })

  return c.json({ revoked: true })
})

// POST /enroll/self — patient self-enrollment via better-auth session token.
// The patient's Bearer token is validated against the main Nuralix API
// (MAIN_API_URL/api/user/me) to identify the patient without requiring a
// hospital staff JWT. MAIN_API_URL must be configured in the hospital server's
// environment variables.
enrollRoutes.post('/enroll/self', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Patient session token required' }, 401)
  }

  const mainApiUrl = process.env.MAIN_API_URL
  if (!mainApiUrl) {
    console.error('[enroll/self] MAIN_API_URL is not configured — patient self-enrollment is unavailable')
    return c.json({ error: 'Self-enrollment is not configured on this server' }, 503)
  }

  // Validate the patient session by calling the main Nuralix API
  let patientId: string
  try {
    const meRes = await fetch(`${mainApiUrl}/api/user/me`, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(8_000),
    })
    if (!meRes.ok) {
      return c.json({ error: 'Invalid or expired patient session' }, 401)
    }
    const me = await meRes.json() as { id?: string }
    if (!me?.id || typeof me.id !== 'string') {
      return c.json({ error: 'Could not identify patient from session' }, 401)
    }
    patientId = me.id
  } catch (err: unknown) {
    console.error('[enroll/self] Failed to validate patient token against main API:', err instanceof Error ? err.message : String(err))
    return c.json({ error: 'Could not verify patient identity. Please try again.' }, 503)
  }

  // Reuse the formData / CompreFace enrollment logic from POST /enroll
  const formData = await c.req.formData().catch(() => null)
  if (!formData) return c.json({ error: 'Invalid form data' }, 400)

  const consentGiven = formData.get('consentGiven') === 'true'
  const imageFile = formData.get('image') as File | null

  if (!consentGiven) return c.json({ error: 'Patient consent is required for biometric enrollment' }, 400)
  if (!imageFile) return c.json({ error: 'Missing image' }, 400)
  if (imageFile.size > 5 * 1024 * 1024) return c.json({ error: 'Image too large. Maximum size is 5 MB.' }, 400)

  const mime = imageFile.type
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    return c.json({ error: 'Invalid image format. Use JPEG, PNG, or WebP.' }, 400)
  }

  // Verify the patient exists in the hospital patients table before touching CompreFace.
  // Without this check, a valid Nuralix session with a userId not yet synced to the
  // hospital DB would succeed in CompreFace, then fail on the FK constraint, leaving
  // an orphaned face embedding with no DB record.
  const patientExists = await queryOne('SELECT id FROM patients WHERE id = $1', [patientId])
  if (!patientExists) {
    return c.json({ error: 'Patient record not found in hospital system. Please ensure your account is registered.' }, 404)
  }

  // Check for existing active enrollment
  const existing = await queryOne(
    'SELECT id FROM biometric_enrollments WHERE patient_id = $1 AND is_active = true',
    [patientId]
  )
  if (existing) return c.json({ error: 'Already enrolled. Revoke existing enrollment first.' }, 409)

  const imageBuffer = Buffer.from(await imageFile.arrayBuffer())
  if (imageBuffer.length === 0) return c.json({ error: 'Image file is empty' }, 400)

  const subjectId = uuidv4()
  try {
    await compreface.enroll(subjectId, imageBuffer)
  } catch (err: unknown) {
    console.error('[enroll/self] CompreFace enroll failed:', err instanceof Error ? err.message : String(err))
    return c.json({ error: 'Face enrollment failed. Please try again.' }, 500)
  }

  const enrollmentId = uuidv4()
  // Wrap enrollment + consent in a transaction — if consent INSERT fails the
  // enrollment row is rolled back, preventing orphaned enrollments without consent.
  await withTransaction(async (txQuery) => {
    await txQuery(
      // enrolled_by is NULL for patient self-enrollment — the FK references hospital_staff(id)
      // and there is no staff row for self-enrollment. NULL is intentional here.
      `INSERT INTO biometric_enrollments (id, patient_id, compreface_subject_id, subject_id_hmac, enrolled_by, is_active, enrolled_at)
       VALUES ($1, $2, $3, $4, $5, true, now())`,
      [enrollmentId, patientId, encrypt(subjectId), hmac(subjectId), null]
    )
    await txQuery(
      `INSERT INTO consents (id, patient_id, consent_type, given, given_at, given_by)
       VALUES ($1, $2, 'biometric', true, now(), $3)
       ON CONFLICT DO NOTHING`,
      [uuidv4(), patientId, 'patient-self']
    )
  })

  await writeAudit({ patientId, action: 'enrollment', success: true })

  return c.json({ enrolled: true, enrollmentId })
})

// GET /enroll/:patientId/status (doctor/nurse/admin only)
enrollRoutes.get('/enroll/:patientId/status', jwtAuth, requireRole('doctor', 'nurse', 'admin'), async (c) => {
  const { patientId } = c.req.param()
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(patientId)) {
    return c.json({ error: 'Invalid patient ID format' }, 400)
  }
  const enrollment = await queryOne<{ enrolled_at: string }>(
    'SELECT enrolled_at FROM biometric_enrollments WHERE patient_id = $1 AND is_active = true',
    [patientId]
  )
  return c.json({ enrolled: !!enrollment, enrolledAt: enrollment?.enrolled_at ?? null })
})

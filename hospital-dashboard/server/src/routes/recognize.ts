import { Hono } from 'hono'
import { v4 as uuidv4 } from 'uuid'
import { query, queryOne } from '../lib/db.js'
import { writeAudit } from '../lib/audit.js'
import { decrypt, hmac } from '../lib/encryption.js'
import { CompreFaceProvider } from '../lib/biometric/CompreFaceProvider.js'
import { jwtAuth } from '../middleware/jwtAuth.js'

const compreface = new CompreFaceProvider()
const SESSION_TTL_MINUTES = 30

// ── In-process rate limiter for recognition endpoints ─────────────────────────
// Limits each staff member to MAX_REQUESTS attempts per WINDOW_MS.
// This guards against brute-force enumeration via the face recognition API.
const RATE_LIMIT_WINDOW_MS = 60_000  // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20   // 20 attempts/min per staff is generous for clinical use
const _rateLimitCounters = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(staffId: string): boolean {
  const now = Date.now()
  const entry = _rateLimitCounters.get(staffId)
  if (!entry || now >= entry.resetAt) {
    _rateLimitCounters.set(staffId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  entry.count += 1
  if (entry.count > MAX_REQUESTS_PER_WINDOW) return false
  return true
}

export const recognizeRoutes = new Hono()

// POST /recognize — face recognition → sessionToken (NO PHI returned)
recognizeRoutes.post('/recognize', jwtAuth, async (c) => {
  const staff = c.get('staff')
  const ip = c.req.header('x-forwarded-for') ?? 'unknown'

  if (!checkRateLimit(staff.staffId)) {
    return c.json({ error: 'Too many recognition attempts. Please wait before trying again.' }, 429)
  }

  const formData = await c.req.formData()
  const imageFile = formData.get('image') as File | null

  if (!imageFile) return c.json({ error: 'No image provided' }, 400)

  // Validate image size (max 5 MB)
  if (imageFile.size > 5 * 1024 * 1024) {
    return c.json({ error: 'Image too large. Maximum size is 5 MB.' }, 400)
  }

  // Validate MIME type
  const mime = imageFile.type
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    return c.json({ error: 'Invalid image format. Use JPEG, PNG, or WebP.' }, 400)
  }

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

  // Fast O(1) HMAC-based lookup: compute HMAC of the returned subjectId and
  // find the matching enrollment directly, instead of decrypting every row.
  // Falls back to full-table decrypt scan for older rows that pre-date the HMAC column.
  const subjectHmac = hmac(result.subjectId)
  const enrollmentByHmac = await queryOne<{ patient_id: string }>(
    'SELECT patient_id FROM biometric_enrollments WHERE subject_id_hmac = $1 AND is_active = true',
    [subjectHmac]
  )

  let patientId: string | null = enrollmentByHmac?.patient_id ?? null

  // Legacy fallback: for enrollments created before the subject_id_hmac column was added,
  // subject_id_hmac will be NULL — scan only those rows.
  if (!patientId) {
    const legacyEnrollments = await query<{ patient_id: string; compreface_subject_id: string }>(
      'SELECT patient_id, compreface_subject_id FROM biometric_enrollments WHERE is_active = true AND subject_id_hmac IS NULL'
    )
    for (const e of legacyEnrollments) {
      try {
        if (decrypt(e.compreface_subject_id) === result.subjectId) {
          patientId = e.patient_id
          break
        }
      } catch (err) {
        console.warn('[recognize] Failed to decrypt compreface_subject_id for legacy enrollment:', err)
      }
    }
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

  if (!name || typeof name !== 'string' || name.trim().length < 1 || name.length > 100) {
    return c.json({ error: 'Name must be between 1 and 100 characters' }, 400)
  }

  // Escape LIKE wildcard characters in the user-supplied name so that a search
  // for "%" doesn't match all patients and cause a full-table dump.
  const escapedName = name.replace(/[%_\\]/g, '\\$&')
  const patients = await query<{ id: string; name: string }>(
    "SELECT id, name FROM patients WHERE lower(name) LIKE lower($1) ESCAPE '\\' LIMIT 5",
    [`%${escapedName}%`]
  )

  if (patients.length === 0) return c.json({ results: [] })

  // Return list of name matches — staff selects one → then call /recognize/select
  return c.json({ results: patients.map(p => ({ id: p.id, name: p.name })) })
})

// POST /recognize/select — select a patient from manual search results
recognizeRoutes.post('/recognize/select', jwtAuth, async (c) => {
  const staff = c.get('staff')
  const { patientId } = await c.req.json<{ patientId: string }>()

  // Validate UUID format to prevent injection and unnecessary DB round-trips
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!patientId || !UUID_RE.test(patientId)) {
    return c.json({ error: 'Invalid patient ID format' }, 400)
  }

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

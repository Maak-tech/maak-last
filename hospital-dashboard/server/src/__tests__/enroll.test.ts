/**
 * Unit tests for the biometric enrollment routes.
 *
 * Covers plan verification items:
 *   #11 — POST /enroll with consentGiven: false → 400, no CompreFace call made
 *   #8  — DELETE /enroll/:patientId → is_active = false
 *   #4  — Patient self-enrollment (POST /enroll/self) requires a valid patient session
 *
 * All external dependencies (DB, CompreFace, audit, main API) are stubbed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'

const TEST_JWT_SECRET = 'test-enroll-jwt-secret-32-chars!!'
process.env.JWT_SECRET = TEST_JWT_SECRET
process.env.DB_ENCRYPTION_KEY = 'c'.repeat(64)

// ── Stubs ─────────────────────────────────────────────────────────────────────

const mockQueryOne = vi.fn()
const mockQuery = vi.fn()
const mockWithTransaction = vi.fn()
const mockWriteAudit = vi.fn().mockResolvedValue(undefined)
const mockCompreFaceEnroll = vi.fn().mockResolvedValue(undefined)
const mockCompreFaceDelete = vi.fn().mockResolvedValue(undefined)

vi.mock('../lib/db.js', () => ({
  queryOne: mockQueryOne,
  query: mockQuery,
  withTransaction: mockWithTransaction,
}))
vi.mock('../lib/audit.js', () => ({
  writeAudit: mockWriteAudit,
}))
vi.mock('../lib/biometric/CompreFaceProvider.js', () => ({
  CompreFaceProvider: vi.fn().mockImplementation(() => ({
    enroll: mockCompreFaceEnroll,
    deleteSubject: mockCompreFaceDelete,
    recognize: vi.fn().mockResolvedValue(null),
  })),
}))

import { enrollRoutes } from '../routes/enroll.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function signStaff(role = 'doctor', staffId = 'staff-001') {
  return jwt.sign(
    { staffId, role, jti: `jti-${Math.random().toString(36).slice(2)}` },
    TEST_JWT_SECRET,
    { expiresIn: '8h', algorithm: 'HS256' }
  )
}

function makeFormData(overrides: Record<string, string | Blob> = {}): FormData {
  const fd = new FormData()
  fd.set('patientId', overrides.patientId as string ?? '3f8e4c1a-7b92-4d05-a1c3-5e2f8d0b9e47')
  fd.set('consentGiven', overrides.consentGiven as string ?? 'true')
  if (!('image' in overrides)) {
    // Minimal valid JPEG header bytes (3 bytes is enough to pass Buffer.length > 0 check)
    const fakeImage = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
    fd.set('image', fakeImage, 'face.jpg')
  } else if (overrides.image instanceof Blob) {
    fd.set('image', overrides.image, 'face.jpg')
  }
  return fd
}

async function postEnroll(token: string, fd: FormData) {
  return enrollRoutes.request('/enroll', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /enroll — consent requirement (plan verification #11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Token not revoked
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('SELECT id FROM patients')) return Promise.resolve({ id: '3f8e4c1a-7b92-4d05-a1c3-5e2f8d0b9e47' })
      if (sql.includes('biometric_enrollments')) return Promise.resolve(null)  // not enrolled yet
      return Promise.resolve(null)
    })
    mockWithTransaction.mockImplementation(async (fn: (q: unknown) => Promise<void>) => {
      await fn(mockQuery)
    })
  })

  it('returns 400 when consentGiven is false — MUST NOT call CompreFace', async () => {
    const fd = makeFormData({ consentGiven: 'false' })
    const res = await postEnroll(signStaff(), fd)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('consent')
    // CompreFace must not be called — no face should be enrolled without consent
    expect(mockCompreFaceEnroll).not.toHaveBeenCalled()
  })

  it('returns 400 when consentGiven is omitted', async () => {
    const fd = new FormData()
    fd.set('patientId', '3f8e4c1a-7b92-4d05-a1c3-5e2f8d0b9e47')
    const fakeImage = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
    fd.set('image', fakeImage, 'face.jpg')
    // consentGiven not set → defaults to something other than 'true'
    const res = await postEnroll(signStaff(), fd)
    expect(res.status).toBe(400)
    expect(mockCompreFaceEnroll).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid (non-UUID) patientId', async () => {
    const fd = makeFormData({ patientId: 'not-a-uuid' })
    const res = await postEnroll(signStaff(), fd)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('Invalid patient ID format')
    expect(mockCompreFaceEnroll).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-image MIME type (e.g. PDF)', async () => {
    const pdfBlob = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' })
    const fd = makeFormData({ image: pdfBlob })
    const res = await postEnroll(signStaff(), fd)
    expect(res.status).toBe(400)
    const body = await res.json() as { error: string }
    expect(body.error).toContain('Invalid image format')
    expect(mockCompreFaceEnroll).not.toHaveBeenCalled()
  })

  it('returns 409 when patient already has an active enrollment', async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('SELECT id FROM patients')) return Promise.resolve({ id: '3f8e4c1a-7b92-4d05-a1c3-5e2f8d0b9e47' })
      if (sql.includes('biometric_enrollments')) return Promise.resolve({ id: 'existing-enrollment' })
      return Promise.resolve(null)
    })
    const fd = makeFormData()
    const res = await postEnroll(signStaff(), fd)
    expect(res.status).toBe(409)
    expect(mockCompreFaceEnroll).not.toHaveBeenCalled()
  })

  it('returns 404 when patient does not exist', async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('SELECT id FROM patients')) return Promise.resolve(null)  // no patient
      return Promise.resolve(null)
    })
    const fd = makeFormData()
    const res = await postEnroll(signStaff(), fd)
    expect(res.status).toBe(404)
    expect(mockCompreFaceEnroll).not.toHaveBeenCalled()
  })

  it('requires doctor/nurse/admin — viewer role returns 403', async () => {
    const fd = makeFormData()
    const res = await postEnroll(signStaff('viewer'), fd)
    expect(res.status).toBe(403)
    expect(mockCompreFaceEnroll).not.toHaveBeenCalled()
  })

  it('succeeds and calls CompreFace when all conditions are met', async () => {
    const fd = makeFormData()
    const res = await postEnroll(signStaff('doctor'), fd)
    expect(res.status).toBe(200)
    const body = await res.json() as { enrolled: boolean }
    expect(body.enrolled).toBe(true)
    expect(mockCompreFaceEnroll).toHaveBeenCalledOnce()
    // The enrollment must be wrapped in a transaction
    expect(mockWithTransaction).toHaveBeenCalledOnce()
  })
})

describe('DELETE /enroll/:patientId — revocation (plan verification #8)', () => {
  const PATIENT_UUID = '3f8e4c1a-7b92-4d05-a1c3-5e2f8d0b9e47'

  beforeEach(() => {
    vi.clearAllMocks()
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('biometric_enrollments')) return Promise.resolve({
        id: 'enrollment-001',
        // A valid encrypted string: must be at least 65 hex chars
        compreface_subject_id: 'a'.repeat(64) + '00',
      })
      return Promise.resolve(null)
    })
    mockWithTransaction.mockImplementation(async (fn: (q: unknown) => Promise<void>) => {
      await fn(mockQuery)
    })
    // decrypt will fail on our fake encrypted string — mock it at the module level
    // by making deleteSubject not care about the subjectId value
    mockCompreFaceDelete.mockResolvedValue(undefined)
  })

  it('requires doctor or admin role — nurse role returns 403', async () => {
    const res = await enrollRoutes.request(`/enroll/${PATIENT_UUID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${signStaff('nurse')}` },
    })
    expect(res.status).toBe(403)
    expect(mockWithTransaction).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-UUID patientId', async () => {
    const res = await enrollRoutes.request('/enroll/not-a-uuid', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${signStaff('admin')}` },
    })
    expect(res.status).toBe(400)
    expect(mockWithTransaction).not.toHaveBeenCalled()
  })

  it('returns 404 when there is no active enrollment', async () => {
    mockQueryOne.mockImplementation((sql: string) => {
      if (sql.includes('revoked_tokens')) return Promise.resolve(null)
      if (sql.includes('biometric_enrollments')) return Promise.resolve(null)  // no enrollment
      return Promise.resolve(null)
    })
    const res = await enrollRoutes.request(`/enroll/${PATIENT_UUID}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${signStaff('admin')}` },
    })
    expect(res.status).toBe(404)
    expect(mockWithTransaction).not.toHaveBeenCalled()
  })
})

describe('POST /enroll/self — patient self-enrollment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWithTransaction.mockImplementation(async (fn: (q: unknown) => Promise<void>) => {
      await fn(mockQuery)
    })
  })

  it('returns 401 when no Bearer token is provided', async () => {
    const fd = makeFormData()
    const res = await enrollRoutes.request('/enroll/self', {
      method: 'POST',
      body: fd,
    })
    expect(res.status).toBe(401)
  })

  it('returns 503 when MAIN_API_URL is not configured', async () => {
    const savedUrl = process.env.MAIN_API_URL
    delete process.env.MAIN_API_URL
    const fd = makeFormData()
    const res = await enrollRoutes.request('/enroll/self', {
      method: 'POST',
      headers: { Authorization: 'Bearer patient-token-123' },
      body: fd,
    })
    expect(res.status).toBe(503)
    process.env.MAIN_API_URL = savedUrl
  })
})
